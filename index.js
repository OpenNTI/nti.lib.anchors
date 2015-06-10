/*globals document, NodeFilter*/
import * as DOM from 'nti.lib.dom';

import isEmpty from 'nti.lib.interfaces/utils/isempty';

import {getModel} from 'nti.lib.interfaces';

const ContentRangeDescription = getModel('contentrange.contentrangedescription');
const DomContentRangeDescription = getModel('contentrange.domcontentrangedescription');

const ElementDomContentPointer = getModel('contentrange.elementdomcontentpointer');
const TextDomContentPointer = getModel('contentrange.textdomcontentpointer');

const TextContext = getModel('contentrange.textcontext');

const CONTAINER_SELECTORS = [
	'object[type$=naquestion][data-ntiid]',
	'object[type$=ntivideo][data-ntiid]'
];

//To control some logging
const isDebug = false;

export const PURIFICATION_TAG = 'data-nti-purification-tag';
export const NON_ANCHORABLE_ATTRIBUTE = 'data-non-anchorable';
export const NO_ANCHORABLE_CHILDREN_ATTRIBUTE = 'data-no-anchors-within';


export function isNodeIgnored (node) {
	return Boolean(	node.getAttribute(NON_ANCHORABLE_ATTRIBUTE) ||
					node.getAttribute(NO_ANCHORABLE_CHILDREN_ATTRIBUTE));
}


const IGNORE_WHITESPACE_TEXTNODES = true;
const IGNORE_WHITESPACE_TEXTNODE_FILTER = {
	acceptNode (node) {
		if (node.nodeType === 3) {
			if (isEmpty(node.textContent.trim())) {
				return NodeFilter.FILTER_REJECT;
			}
		}
		return NodeFilter.FILTER_ACCEPT;
	}
};


function getWhitespaceFilter () {
	if (!IGNORE_WHITESPACE_TEXTNODES) {
		return null;
	}

	//Sigh. Imagine that, some browsers want a proper NodeFilter and some want just a function.
	//See http://stackoverflow.com/questions/5982648/recommendations-for-working-around-ie9-treewalker-filter-bug
	let {acceptNode} = IGNORE_WHITESPACE_TEXTNODE_FILTER;

	function safeFilter (...a) { return acceptNode(...a); }
	Object.assign(safeFilter, {acceptNode});

	return safeFilter;
}


//Is this a content range description we know how to deal with.
//We handle non nil values that are empty or dom content range descriptions
function supportedContentRange (contentRangeDescription) {
	if (!contentRangeDescription) {
		return false;
	}

	return contentRangeDescription.isEmpty || contentRangeDescription.isDomContentRangeDescription;
}


const ANCHOR_LIB_API = {
	locateElementDomContentPointer,
	locateRangeEdgeForAnchor
};


function locateRangePointInAncestor(model, ...ancestorNode) {
	return model.locateRangePointInAncestor(ANCHOR_LIB_API, ...ancestorNode);
}


//FIXME we run into potential problems with this is ContentRangeDescriptions ever occur in different documents
//or locations but have the same container id.  That seem unlikely but may Need to figure that out eventually
export function preresolveLocatorInfo (contentRangeDescriptions, docElement, cleanRoot, containers, docElementContainerId) {
	let virginContentCache = {};
	let locatorsFound = 0;

	docElementContainerId = docElementContainerId || rootContainerIdFromDocument(docElement);

	if (!contentRangeDescriptions || (containers && contentRangeDescriptions.length !== containers.length)) {
		throw new Error('toDomRanges requires contentRangeDescriptions and containers to be the same length if containers provided');
	}

	function getVirginNode(node) {
		let theId = node.getAttribute('id'),
			key = theId || node,
			clean;

		if (!node) {
			return null;
		}

		clean = virginContentCache[node];
		if (!clean) {
			clean = node.cloneNode(true);
			virginContentCache[key] = clean;
		}
		return clean;
	}

	function cacheLocatorForDescription(desc, docElement2, cleanRoot2, containerId2, docElementContainerId2) {
		let searchWithin, ancestorNode, virginNode;

		if (!containerId2) {
			console.warn('No container id provided will assume root without validating container');
		}

		if (!supportedContentRange(desc)) {
			console.warn('nothing to parse?');
			return;
		}

		if (desc.isEmpty || cachedLocatorEnsuringDocument(desc, docElement2)) {
			locatorsFound++;
			return;
		}

		searchWithin = scopedContainerNode(cleanRoot2, containerId2, docElementContainerId2);
		if (!searchWithin) {
			throw new Error('Unable to find container ' + containerId2 + ' in provided doc element');
		}

		ancestorNode = locateRangePointInAncestor(desc.getAncestor(), searchWithin).node || searchWithin;
		if (!ancestorNode) {
			throw new Error('Failed to get ancestor node for description. ' + desc + ' This should happen b/c we should default to ' + searchWithin);
		}

		virginNode = getVirginNode(ancestorNode);

		try {
			if (resolveCleanLocatorForDesc(desc, virginNode, docElement2)) {
				locatorsFound++;
			}
		}
		catch (e) {
			console.error('Error resolving locator for desc', desc, e);
		}
	}

	//First step is build all the locators cloning and purifying the least
	//amount possible.  That is one of the places the profiler indicated problems
	contentRangeDescriptions.forEach((desc, idx) => {
		let containerId = containers ? containers[idx] : null;
		try {
			cacheLocatorForDescription(desc, docElement, cleanRoot, containerId, docElementContainerId);
		}
		catch (e) {
			console.error('Unable to generate locator for desc', e);
		}
	});

	console[locatorsFound === contentRangeDescriptions.length ?
			'log' : 'warn']('Preresolved ' + locatorsFound + '/' + contentRangeDescriptions.length + ' range descriptions');
}


export function toDomRange (contentRangeDescription, docElement, cleanRoot, containerId, docElementContainerId) {
	let ancestorNode, resultRange, searchWithin, locator;

	if (!supportedContentRange(contentRangeDescription)) {
		console.warn('nothing to parse?');
		return null;
	}

	docElementContainerId = docElementContainerId || rootContainerIdFromDocument(docElement);

	try {

		if (!containerId) {
			console.log('No container id provided will use root without validating container ids');
		}

		//FIXME we run into potential problems with this is ContentRangeDescriptions ever occur in different documents
		//or locations but have the same container id.  That seem unlikely but may Need to figure that out eventually
		//Optimization shortcut, if we have a cached locator use it
		//TODO a potential optimization here is that if locator() is defined but null return null.  We already tried
		//to resolve it once and it failed.  Right now we try again but in reality nothing changes between when we
		//preresolve the locator and now
		locator = cachedLocatorEnsuringDocument(contentRangeDescription, docElement);
		if (locator) {
			return convertContentRangeToDomRange(locator.start, locator.end, locator.doc);
		}


		if (contentRangeDescription.isEmpty) {
			return createEmptyContentRangeDescription(docElement, containerId, docElementContainerId);
		}

		if (!cleanRoot) {
			cleanRoot = (docElement.body || findElementsWithTagName(docElement, 'body')[0] || docElement).cloneNode(true);
			purifyNode(cleanRoot);
		}

		searchWithin = scopedContainerNode(cleanRoot, containerId, docElementContainerId);
		if (!searchWithin) {
			throw new Error('Unable to find container ' + containerId + ' in provided doc element');
		}
		ancestorNode = locateRangePointInAncestor(contentRangeDescription.getAncestor(), searchWithin).node || searchWithin;

		if (!ancestorNode) {
			throw new Error('Failed to get ancestor node for description. ' + contentRangeDescription +
							' This should happen b/c we should default to ' + searchWithin);
		}

		resultRange = resolveSpecBeneathAncestor(contentRangeDescription, ancestorNode, docElement);

		return resultRange;
	}
	catch (e) {
		console.warn('Unable to generate range for description', e);
	}
	return null;
}


function findElementsWithTagName (root, name) {
	if (root.getElementsByTagName) {
		return root.getElementsByTagName(name);
	}
	return root.querySelectorAll(name);
}


function createRange(contextNode) {
	if (!contextNode.createRange) {
		contextNode = contextNode.ownerDocument || document;
	}
	return contextNode.createRange();
}


/*
 *	Returns a boolean indicating whether or not the provided contentRangeDescription
 *  can be found in the provided node
 *
 *	@param contentRagneDescription must not be null
 *  @param node the node to look in.  This node must be clean.  IE it must come from the virgin
 *				content document or it must have been cleaned already
 *  @param doc the doc or doc fragment that can be used to generate ranges.  If this param is undefined
 *				node.ownderDocument will be used
 *
 *  Note: if we find ourselves using inside a loop over contentRangeDescriptions on the same node
 *  an optimized versio nof this function should be written and used
 */
export function doesContentRangeDescriptionResolve (contentRangeDescription, node, doc) {
	let result, range, theDoc = (node && node.ownerDocument) || doc;

	//Ok so this sucks.  There is a complicated reason why we can't let ourselves
	//use our cached locator for this query.  Basically, the locator gets cached by the owner document
	//that the original range is resolved from.  The problem is sometimes node is a docFragment that
	//we really want the search scoped within, however the docFragment has an owner doc of the main
	//document (one place this happens is presentation mode).  This means that this method could return
	//yes if the contentRangeDescription resolves in nodes ownerdoc even if it is not technically
	//resolved beneath node.  This is partly a result of this method being bolted on to an existing implementation
	//as well as a caching strategy that was devised back when we only ever used the anchor methods on the content
	//fragment.  Unfortunately the easiest, and safest, thing to do about this is prevent the locator from
	//being used.  Double unfortunately, the only way to do that right now is to dump the cached information.
	if (contentRangeDescription) {
		contentRangeDescription.attachLocator(null);
	}

	range = locateContentRangeDescription(contentRangeDescription, node, theDoc);


	result = !!range;
	if (range && range.detach) {
		range.detach();
	}
	return result;
}


//TODO lots of duplicated code here
function locateContentRangeDescription (contentRangeDescription, cleanRoot, doc) {
	let ancestorNode, resultRange, searchWithin, containerId, docElementContainerId,
			docElement = (cleanRoot && cleanRoot.ownerDocument) || doc, locator;

	if (!supportedContentRange(contentRangeDescription)) {
		console.warn('nothing to parse?');
		return null;
	}

	docElementContainerId = rootContainerIdFromDocument(docElement);

	try {

		if (!containerId) {
			console.log('No container id provided will use root without validating container ids');
		}

		//FIXME we run into potential problems with this is ContentRangeDescriptions ever occur in different documents
		//or locations but have the same container id.  That seem unlikely but may Need to figure that out eventually
		//Optimization shortcut, if we have a cached locator use it
		//TODO a potential optimization here is that if locator() is defined but null return null.  We already tried
		//to resolve it once and it failed.  Right now we try again but in reality nothing changes between when we
		//preresolve the locator and now
		locator = cachedLocatorEnsuringDocument(contentRangeDescription, docElement);
		if (locator) {
			return convertContentRangeToDomRange(locator.start, locator.end, locator.doc);
		}


		if (contentRangeDescription.isEmpty) {
			return createEmptyContentRangeDescription(docElement, containerId, docElementContainerId);
		}

		if (!cleanRoot) {
			cleanRoot = (docElement.body || findElementsWithTagName(docElement, 'body')[0] || docElement).cloneNode(true);
			purifyNode(cleanRoot);
		}

		searchWithin = scopedContainerNode(cleanRoot, containerId, docElementContainerId);
		if (!searchWithin) {
			throw new Error('Unable to find container ' + containerId + ' in provided doc element');
		}
		ancestorNode = locateRangePointInAncestor(contentRangeDescription.getAncestor(), searchWithin).node || searchWithin;

		if (!ancestorNode) {
			throw new Error('Failed to get ancestor node for description. ' + contentRangeDescription + ' This should happen b/c we should default to ' + searchWithin);
		}

		resultRange = resolveCleanLocatorForDesc(contentRangeDescription, ancestorNode, docElement);

		return resultRange;
	}
	catch (e) {
		console.warn('Unable to generate range for description', e);
	}
	return null;
}


function createEmptyContentRangeDescription (docElement, containerId, rootId) {
	let searchWithin = scopedContainerNode(docElement, containerId, rootId), resultRange;

	if (!searchWithin) {
		throw new Error('Unable to find container ' + containerId + ' in provided docElement');
	}

	//console.debug('Given an empty content range description, returning a range wrapping the container', searchWithin);
	resultRange = createRange(docElement);
	resultRange.selectNode(searchWithin);
	return resultRange;
}


function cachedLocatorEnsuringDocument (contentRangeDescription, document) {
	let loc = contentRangeDescription.locator();
	if (loc && loc.doc !== document) {
		console.debug('Dumping locator because its from a different doc');
		contentRangeDescription.attachLocator(null);
		loc = null;
	}
	return loc;
}


/*tested*/
export function scopedContainerNode (fragOrNode, containerId, rootId) {
	let searchWithin,
		node = fragOrNode.body || findElementsWithTagName(fragOrNode, 'body')[0] || fragOrNode;

	if (!containerId) {
		searchWithin = node;
	}
	else {
		searchWithin = (rootId !== containerId) ? getContainerNode(containerId, node, null) : node;
	}

	return searchWithin;
}


function rootContainerIdFromDocument (doc) {
	if (!doc) {
		return null;
	}

	let foundContainer, metaNtiidTag,
		head = doc.head || findElementsWithTagName(doc, 'head')[0];

	if (head) {
		metaNtiidTag = head.querySelectorAll('meta[name="NTIID"]');
		if (metaNtiidTag && metaNtiidTag.length > 0) {
			if (metaNtiidTag.length > 1) {
				console.error('Encountered more than one NTIID meta tag. Using first, expect problems', metaNtiidTag);
			}
			metaNtiidTag = metaNtiidTag[0];
		}
		else {
			metaNtiidTag = null;
		}
		if (metaNtiidTag) {
			foundContainer = metaNtiidTag.getAttribute('content');
		}
	}
	return foundContainer;
}


/* tested */
export function createRangeDescriptionFromRange (range, docElement) {
	if (!range) {
		console.log('Returning empty ContentRangeDescription for null range');
		return {description: new ContentRangeDescription(null, null, {})};
	}

	cleanRangeFromBadStartAndEndContainers(range);
	range = makeRangeAnchorable(range, docElement);
	if (!range || range.collapsed) {
		console.error('Anchorable range for provided range could not be found', range);
		throw new Error('Anchorable range for range could not be found');
	}

	let pureRange = purifyRange(range, docElement),
		ancestorAnchor,
		ancestorNode = range.commonAncestorContainer,
		result = {};

	if (!pureRange || pureRange.collapsed) {
		console.error('Unable to purify anchorable range', range, pureRange);
		throw new Error('Unable to purify anchorable range for ContentRangeDescription generation');
	}

	//If the ancestorcontainer is a text node, we want a containing element as per the docs
	//NOTE: use range, not pureRange here because the pureRange's ancestor is probably a doc fragment.
	if (DOM.isTextNode(ancestorNode)) {
		ancestorNode = ancestorNode.parentNode;
	}
	ancestorNode = referenceNodeForNode(ancestorNode);

	result.container = getContainerNtiid(ancestorNode, docElement);

	ancestorAnchor = new ElementDomContentPointer(null, null, {
		node: ancestorNode,
		role: 'ancestor'
	});

	try {
		result.description = new DomContentRangeDescription(null, null, {
			start: createPointer(pureRange, 'start'),
			end: createPointer(pureRange, 'end'),
			ancestor: ancestorAnchor
		});
	} catch (e) {
		console.warn('There was an error generating the description, hopefully the container will do.', e);
	}
	return result;
}


/*
 *	Returns the node for the supplied container or defaultNode
 *  if that container can't be found.  If containerId resolves
 *  to a node that isn't valid as described by getContainerNtiid
 *  we warn and return the node anyway
 */
function getContainerNode (containerId, root, defaultNode) {
	let result, isContainerNode = false,
		potentials = [];

	if (!containerId) {
		return null;
	}


	if (containerId.indexOf('tag:nextthought.com') >= 0) {
		for(let x of root.querySelectorAll('[data-ntiid]')) {
			if (x.getAttribute('data-ntiid') === containerId) {
				potentials.push(x);
			}
		}
	}
	else {
		if (root.getElementById) {
			potentials.push(root.getElementById(containerId));
		}
		else {
			potentials = root.querySelectorAll('[id="' + containerId + '"]');
		}
	}

	if (!potentials || potentials.length === 0) {
		return defaultNode;
	}

	if (potentials.length > 1) {
		//TODO what do we actually do here?
		console.warn('Found several matches for container. Will return first. Bad content?', containerId, potentials);
	}

	result = potentials[0];

	for(let sel of CONTAINER_SELECTORS) {
		isContainerNode = isContainerNode || DOM.matches(result, sel);
	}

	if (!isContainerNode) {
		console.warn('Found container we think is an invalid container node', result);
	}

	return result.dom;
}


/*
 *	Finds a containerId for the closet valid container
 *  of node.  At this point valid cantainers are questions
 *  with a data-ntiid attribute or the page.  Note we currently
 *  don't contain things in section-style sub containers.  Support on
 *  the ds is questionable and other parts of the app (carousel?) will
 *  need to be reworked
 */
function getContainerNtiid (node, def) {
	let n = node, ntiidAttr = 'data-ntiid', containerNode;

	function ancestorOrSelfMatchingSelector(x, sel) {
		if (!x) {
			return false;
		}
		return DOM.matches(x, sel) ? x : DOM.parent(node, sel);
	}

	function nodeIfObject (x) {
		if (!x) {
			return null;
		}

		for(let sel of CONTAINER_SELECTORS) {
			let y = ancestorOrSelfMatchingSelector(x, sel);
			if (y) {
				return y;
			}
		}

		return null;
	}

	containerNode = nodeIfObject(node);

	if (containerNode) {
		return containerNode.getAttribute(ntiidAttr);
	}

	//ok its not in a subcontainer, return default
	if (def && typeof def !== 'string') {
		n = def.querySelector('[data-page-ntiid]') || {};
		n = n.getAttribute && n.getAttribute('data-page-ntiid');
		if (n) {
			def = n;
		}
	}

	return def;
}


function doesElementMatchPointer (element, pointer) {
	let id = element.id || (element.getAttribute ? element.getAttribute('id') : null);
	let tag = element.tagName.toUpperCase();

	let pointerTag = pointer.elementTagName.toUpperCase();

	let idMatches = (id === pointer.elementId || (element.getAttribute && element.getAttribute('data-ntiid') === pointer.elementId));
	let tagMatches = tag === pointerTag;

	if (!tagMatches && pointer.elementId === 'NTIContent' && tag === 'NTI-CONTENT') {
		tagMatches = true;
	}

	return idMatches && tagMatches;
}


//TODO - testing
function createPointer (range, role, node) {
	let edgeNode = node || nodeThatIsEdgeOfRange(range, (role === 'start'));

	if (DOM.isTextNode(edgeNode)) {
		return createTextPointerFromRange(range, role);
	}

	if (DOM.isElement(edgeNode)) {
		return new ElementDomContentPointer(null, null, {
			elementTagName: edgeNode.tagName,
			elementId: edgeNode.getAttribute('data-ntiid') || edgeNode.getAttribute('id'),
			role: role
		});
	}

	console.error('Not sure what to do with this node', node, role);
	throw new Error('Unable to translate node to pointer');
}


/* tested */
export function createTextPointerFromRange (range, role) {
	if (!range) {
		throw new Error('Cannot proceed without range');
	}

	let start = role === 'start',
		container = start ? range.startContainer : range.endContainer,
		offset = start ? range.startOffset : range.endOffset,
		contexts = [],
		edgeOffset,
		ancestor,
		parent = container.parentNode,
		referenceNode,
		additionalContext,
		primaryContext,
		normalizedOffset,
		collectedCharacters = 0,
		maxSubsequentContextObjects = 5,
		maxCollectedChars = 15,
		filter = getWhitespaceFilter(),
		walker,
		nextSiblingFunction,
		sibling;

	if (!DOM.isTextNode(container)) {
		container = nodeThatIsEdgeOfRange(range, (role === 'start'));
		offset = role === 'start' ? 0 : container.textContent.length;
	}

	//If we run into a doc fragment here, then we may have to bump out of the fragment:
	if (parent.nodeType === 11) { //DOCUMENT_FRAGMENT_NODE
		parent = range.ownerNode;
	}

	referenceNode = referenceNodeForNode(parent);

	ancestor = createPointer(range, 'ancestor', referenceNode);

	primaryContext = generatePrimaryContext(range, role);

	if (primaryContext) {
		contexts.push(primaryContext);
	}

	//Generate the edge offset
	normalizedOffset = primaryContext.getContextOffset();
	if (start) {
		normalizedOffset = container.textContent.length - normalizedOffset;
	}

	edgeOffset = offset - normalizedOffset;

	//Now we want to collect subsequent context
	walker = document.createTreeWalker(referenceNode, NodeFilter.SHOW_TEXT, filter, false);
	walker.currentNode = container;

	nextSiblingFunction = start ? walker.previousNode : walker.nextNode;

	sibling = nextSiblingFunction.call(walker);
	while (sibling) {
		if (collectedCharacters >= maxCollectedChars ||
			contexts.length - 1 >= maxSubsequentContextObjects) { break; }

		additionalContext = generateAdditionalContext(sibling, role);
		collectedCharacters += additionalContext.getContextText().length;
		contexts.push(additionalContext);

		sibling = nextSiblingFunction.call(walker);
	}

	return new TextDomContentPointer(null, null, {
		role: role,
		contexts: contexts,
		edgeOffset: edgeOffset,
		ancestor: ancestor
	});
}


/* tested */
export function generateAdditionalContext (relativeNode, role) {
	if (!relativeNode) {
		throw new Error('Node must not be null');
	}
	let contextText = null, offset;
	if (role === 'start') {
		contextText = lastWordFromString(relativeNode.textContent);
	}
	else {
		contextText = firstWordFromString(relativeNode.textContent);
	}

	if (!contextText && contextText.length === 0) {
		return null;
	}

	offset = relativeNode.textContent.indexOf(contextText);
	if (role === 'start') {
		offset = relativeNode.textContent.length - offset;
	}

	return new TextContext(null, null, {
		contextText: contextText,
		contextOffset: offset
	});
}


/* tested */
export function generatePrimaryContext (range, role) {
	if (!range) {
		throw new Error('Range must not be null');
	}

	let container = null,
		offset = null,
		contextText, contextOffset, textContent, prefix, suffix;

	if (role === 'start') {
		container = range.startContainer;
		offset = range.startOffset;
	}
	else {
		container = range.endContainer;
		offset = range.endOffset;
	}

	if (!DOM.isTextNode(container)) {
		container = nodeThatIsEdgeOfRange(range, (role === 'start'));
		offset = role === 'start' ? 0 : container.textContent.length;
	}

	//For the primary context we want a word on each side of the
	//range
	textContent = container.textContent;
	if (!textContent || textContent.length === 0) {
		return null;
	}

	prefix = lastWordFromString(textContent.substring(0, offset));
	suffix = firstWordFromString(textContent.substring(offset, textContent.length));

	contextText = prefix + suffix;
	contextOffset = textContent.indexOf(contextText);

	//If start then we readjust offset to be from the right side...
	if (role === 'start') {
		contextOffset = textContent.length - contextOffset;
	}

	//console.log('Created Context, TEXT', "'"+textContent+"'", 'CONTEXT', contextText, 'OFFSET', contextOffset);

	return new TextContext(null, null, {
		contextText: contextText,
		contextOffset: contextOffset
	});
}


/* tested */
export function lastWordFromString (str) {
	if (str == null) {
		throw new Error('Must supply a string');
	}
	return (/\S*\s?$/).exec(str)[0];
}


/* tested */
export function firstWordFromString (str) {
	if (str == null) {
		throw new Error('Must supply a string');
	}
	return (/^\s?\S*/).exec(str)[0];
}


function resolveCleanLocatorForDesc (rangeDesc, ancestor, docElement) {
	let confidenceCutoff = 0.4, loc,
		startResult,
		endResult,
		startResultLocator,
		endResultLocator,
		locatorInfo;

	if (!rangeDesc) {
		throw new Error('Must supply Description');
	}
	else if (!docElement) {
		throw new Error('Must supply a docElement');
	}

	loc = cachedLocatorEnsuringDocument(rangeDesc, docElement);
	if (loc) {
		//console.debug('Using cached locator info');
		return loc;
	}

	startResult = locateRangePointInAncestor(rangeDesc.getStart(), ancestor);
	if (!startResult.node ||
		!startResult.hasOwnProperty('confidence') ||
		startResult.confidence === 0) {
		if (isDebug) {
			console.warn('No possible start found for', rangeDesc, startResult);
		}
		return null;
	}

	if (startResult.confidence < confidenceCutoff) {
		if (isDebug) {
			console.warn('No start found with an acceptable confidence.', startResult, rangeDesc);
		}
		return null;
	}

	if (startResult.confidence < 1.0) {
		if (isDebug) {
			console.log('Matched start with confidence of', startResult.confidence, startResult, rangeDesc);
		}
	}
	else {
		if (isDebug) {
			console.log('Found an exact match for start', startResult, rangeDesc);
		}
	}

	endResult = locateRangePointInAncestor(rangeDesc.getEnd(), ancestor, startResult);
	if (!endResult.node ||
		!endResult.hasOwnProperty('confidence') ||
		endResult.confidence === 0) {
		if (isDebug) {
			console.warn('No possible end found for', rangeDesc, endResult);
		}
		return null;
	}

	if (endResult.confidence < confidenceCutoff) {
		if (isDebug) {
			console.warn('No end found with an acceptable confidence.', endResult, rangeDesc);
		}
		return null;
	}

	if (endResult.confidence < 1.0) {
		if (isDebug) {
			console.log('Matched end with confidence of', endResult.confidence, endResult, rangeDesc);
		}
	}
	else {
		if (isDebug) {
			console.log('Found an exact match for end', endResult, rangeDesc);
		}
	}

	startResultLocator = toReferenceNodeXpathAndOffset(startResult);
	endResultLocator = toReferenceNodeXpathAndOffset(endResult);

	//Right not rangeDescriptions and the virgin content are immutable so stash the locator
	//on the desc to save work
	locatorInfo = {start: startResultLocator, end: endResultLocator, doc: docElement};
	rangeDesc.attachLocator(locatorInfo);
	return locatorInfo;
}


/* tested */
export function resolveSpecBeneathAncestor (rangeDesc, ancestor, docElement) {
	let locator = resolveCleanLocatorForDesc(rangeDesc, ancestor, docElement);
	if (!locator) {
		return null;
	}

	return convertContentRangeToDomRange(locator.start, locator.end, locator.doc);
}


//TODO - testing
function convertContentRangeToDomRange (startResult, endResult, docElement) {

	let liveStartResult = convertStaticResultToLiveDomContainerAndOffset(startResult, docElement),
		liveEndResult = convertStaticResultToLiveDomContainerAndOffset(endResult, docElement),
		range;

	//		console.log('liveStartResult', liveStartResult, 'liveEndResult', liveEndResult);
	if (!liveStartResult || !liveEndResult) {
		return null;
	}

	range = createRange(docElement);
	if (liveStartResult.hasOwnProperty('offset')) {
		range.setStart(liveStartResult.container, liveStartResult.offset);
	}
	else {
		range.setStartBefore(liveStartResult.container);
	}

	if (liveEndResult.hasOwnProperty('offset')) {
		range.setEnd(liveEndResult.container, liveEndResult.offset);
	}
	else {
		range.setEndAfter(liveEndResult.container);
	}
	return range;
}


/* tested */
export function locateElementDomContentPointer (pointer, ancestor) {
	//only element dom pointers after this point:
	if (!(pointer instanceof ElementDomContentPointer)) {
		throw new Error('This method expects ElementDomContentPointers only');
	}

	//In these case of the document body (root) we may be the ancestor
	if (doesElementMatchPointer(ancestor, pointer)) {
		return {confidence: 1, node: ancestor};
	}

	let theId = pointer.getElementId(),
		potentials = [], parts,
		p, i, r;

	if (theId.indexOf('tag:nextthought.com') === 0) {
		parts = theId.split(',');
		if (parts.length < 2) {
			console.warn('Encountered an ntiid looking id that doesn\'t split by comma');
		}
		else {
			//Note this may not technically be an exact match, but the potentials loop below should weed out any issues
			potentials = ancestor.querySelectorAll('[data-ntiid^="' + parts.first() + '"][data-ntiid$="' + parts.last() + '"]');
		}
	}
	else {
		potentials = ancestor.querySelectorAll('[id="' + theId + '"]');
	}


	for (i in potentials) {
		if (potentials.hasOwnProperty(i)) {
			p = potentials[i];
			if (doesElementMatchPointer(p, pointer)) {
				r = {confidence: 1, node: p};
			}
			else if (isDebug) {
				console.warn('Potential match doesn\'t match pointer', p, pointer);
			}

			if (r) {
				return r;
			}
		}
	}

	return {confidence: 0};
}


/* tested */
function isNodeChildOfAncestor (node, ancestor) {
	while (node && node.parentNode) {
		if (node.parentNode === ancestor) {
			return true;
		}
		node = node.parentNode;
	}
	return false;
}


/* tested */
export function locateRangeEdgeForAnchor (pointer, ancestorNode, startResult) {
	if (!pointer) {
		throw new Error('Must supply a Pointer');
	}
	else if (!(pointer instanceof TextDomContentPointer)) {
		throw new Error('ContentPointer must be a TextDomContentPointer');
	}

	//Resolution starts by locating the reference node
	//for this text anchor.  If it can't be found ancestor is used

	let root = ancestorNode,
		referenceNode,
		foundReferenceNode,
		isStart,
		treeWalker,
		textNode,
		result = {},
		matches,
		possibleNodes = [],
		done = false,
		i, filter;

	if (root.parentNode) {
		root = root.parentNode;
	}

	referenceNode = locateRangePointInAncestor(pointer.getAncestor(), root).node;
	foundReferenceNode = true;
	if (!referenceNode) {
		foundReferenceNode = false;
		referenceNode = ancestorNode;
	}

	isStart = pointer.getRole() === 'start';

	//We use a tree walker to search beneath the reference node
	//for textContent matching our contexts
	filter = getWhitespaceFilter();
	treeWalker = document.createTreeWalker(referenceNode, NodeFilter.SHOW_TEXT, filter, false);

	//If we are looking for the end node.  we want to start
	//looking where the start node ended.  This is a shortcut
	//in the event that the found start node is in our reference node
	if (!isStart && startResult && startResult.node && isNodeChildOfAncestor(startResult.node, referenceNode)) {

		treeWalker.currentNode = startResult.node;
	}

	//We may be in the same textNode as start
	if (DOM.isTextNode(treeWalker.currentNode)) {
		textNode = treeWalker.currentNode;
	}
	else {
		textNode = treeWalker.nextNode();
	}

	//In the past we had contexts with empty contextText
	//that added no value but made things more fragile.
	//We don't create those anymore but for old data we filter them out.
	//Note we do this here for performance reasons.  It is a more localized change
	//to do this in getCurrentNodeMatches but that gets called for every node we
	//are iterating over.  Maybe there is a better way to architect this since its probably
	//a change that stays in place for ever...
	if (getWhitespaceFilter()) {
		pointer.nonEmptyContexts = pointer.getContexts().filter((c, ix) => {
			//Always keep the primary.  It should never be empty, but just in case
			if (ix === 0) {
				if (isEmpty(c.contextText.trim())) {
					console.error('Found a primary context with empty contextText.  Where did that come from?', pointer);
				}
				return true;
			}
			return !isEmpty(c.contextText.trim());
		});
	}
	else {
		pointer.nonEmptyContexts = pointer.getContexts();
	}

	while (textNode && !done) {
		matches = getCurrentNodeMatches(pointer, treeWalker);
		for (i = 0; i < matches.length; i++) {
			result = matches[i];
			if (matches[i].confidence > 0) {
				possibleNodes.push(matches[i]);
			}
			//100% sure, that is the best we can do
			if (matches[i].confidence === 1) {
				done = true;
				break;
			}
		}
		if (done) {
			break;
		}

		//Start the context search over in the next textnode
		textNode = treeWalker.nextNode();
	}

	//If we made it through the tree without finding
	//a node we failed
	if (possibleNodes.length === 0) {
		return {confidence: 0};
	}


	//Did we stop because we found a perfect match?
	if (possibleNodes[possibleNodes.length - 1].confidence === 1) {
		result = possibleNodes[possibleNodes.length - 1];
	}
	else {
		//Not a perfect match, if we are in a properly
		//resolved reference node we want the thing that
		//makes us the largest range.  If not we fail to resolve
		if (!foundReferenceNode) {
			//TODO hmm so if we failed to resolve the reference node and we fell back
			//to looking in the ancestor we don't do any partial matching.  We should
			//reevaluate this decision.  In something like the mathcounts case where we have stuff anchored
			//to non stable ids that have changed we end up never partial matching.
			//Instead of doing that maybe instead of not trying to partial match we just take a
			//deduciton from the overal confidence.
			if (isDebug) {
				console.info('Ignoring fuzzy matching because we could not resolve the pointers ancestor', pointer, possibleNodes, ancestorNode);
			}
			return {confidence: 0};
		}


		//We want the best match
		//NOTE in the past we were "normalizing" the highest confidence
		//by dividing by the sum of all the confidence values.  Not
		//only is that an improper way to normalize these values,
		//it is counterintuitive to what we are actually trying to do.
		if (result === null) {
			result = {confidence: 0};
		}
		if (isDebug) {
			console.log('Searching for best ' + pointer.getRole() + ' match in ', possibleNodes);
		}
		for (i = 0; i < possibleNodes.length; i++) {
			if (possibleNodes[i].confidence > result.confidence) {
				result = possibleNodes[i];
			}
		}

	}
	return result;
}


function getCurrentNodeMatches (pointer, treeWalker) {

	let currentNode = treeWalker.currentNode,
		lookingAtNode = currentNode,
		isStart = pointer.getRole() === 'start',
		siblingFunction = isStart ? treeWalker.previousNode : treeWalker.nextNode,
		confidenceMultiplier = 1;

	function multiIndexOf(str, tomatch) {
		let all = [], next = -2;
		while (next !== -1) {
			next = str.indexOf(tomatch, next + 1);
			if (next !== -1) {
				all.push(next);
			}
		}
		return all;
	}

	function getPrimaryContextMatches(context, node, start) {
		if (!node) {
			return [];
		}

		let allmatches = [];
		let adjustedOffset = context.contextOffset;
		let nodeContent = node.textContent;


		if (start) {
			adjustedOffset = node.textContent.length - adjustedOffset;
		}

		let p = multiIndexOf(nodeContent, context.contextText);
		for (let i = 0; i < p.length; i++) {
			//Penalzies score based on disparity between expected
			//and real offset. For longer paragraphs, which we
			//expect will have larger and more changes made to them,
			//we relax the extent of the penalty
			let f = Math.sqrt(node.textContent.length) * 2 + 1;
			let score = f / (f + Math.abs(p[i] - adjustedOffset));
			if (score < 0.25) {
				score = 0.25;
			}
			allmatches.push({offset: p[i] + pointer.getEdgeOffset(),
				node: currentNode,
				confidence: score});
		}
		return allmatches;
	}

	function secondaryContextMatch(context, node, start) {
		if (!node) {
			return 0;
		}
		if (node.nodeType === node.ELEMENT_NODE) {
			return context.contextText === '';
		}
		let adjustedOffset = context.contextOffset;

		if (start) {
			adjustedOffset = node.textContent.length - adjustedOffset;
		}
		return node.textContent.substr(adjustedOffset).indexOf(context.contextText) === 0;
	}


	if (pointer.nonEmptyContexts === undefined) {
		console.error('nonEmptyContexts not set. This should only happen when testing');
		pointer.nonEmptyContexts = pointer.getContexts().filter((c, i) => {
			//Always keep the primary.  It should never be empty, but just in case
			if (i === 0) {
				if (isEmpty(c.contextText.trim())) {
					console.error('Found a primary context with empty contextText.  Where did that come from?', pointer);
				}
				return true;
			}
			return !isEmpty(c.contextText.trim());
		});
	}

	let contexts = pointer.nonEmptyContexts, //Caller sets this up
		contextObj = contexts[0],
		numContexts = contexts.length,
		matches = getPrimaryContextMatches(contextObj, lookingAtNode, isStart);

	lookingAtNode = siblingFunction.call(treeWalker);

	if (matches.length > 0) {
		for (let i = 1; i < numContexts; i++) {
			contextObj = contexts[i];

			let c = secondaryContextMatch(contextObj, lookingAtNode, isStart);
			if (!c) {
				confidenceMultiplier *= i / (i + 0.5);
				break;
			}
			//That context matched so we continue verifying.
			lookingAtNode = siblingFunction.call(treeWalker);
		}
	}

	//If we don't have a full set of contexts.  lookingAtNode
	//should be null here.  If it isn't, then we might have a problem
	if (confidenceMultiplier === 1) {
		//TODO in our handling of past data we assume that if it had a full context
		//before we stripped out the empty Context objects it has full context after that.
		//I think that is the right behaviour for what is intended here.
		if (!containsFullContext(pointer) && lookingAtNode) {
			if (lookingAtNode) {
				confidenceMultiplier *= numContexts / (numContexts + 0.5);
			}
		}
	}
	for (let i = 0; i < matches.length; i++) {
		matches[i].confidence *= confidenceMultiplier;
	}
	treeWalker.currentNode = currentNode;
	return matches;
}


function containsFullContext (pointer) {
	//Do we have a primary + 5 additional?

	if (!pointer.getContexts()) {
		return false;
	}

	if (pointer.getContexts().length >= 6) {
		return true;
	}

	//Maybe we have 5 characters of additional context
	let i, chars = 0;

	for (i = 1; i < pointer.getContexts().length; i++) {
		chars += pointer.getContexts()[i].contextText.length;
	}

	return chars >= 15;
}


/* tested */
function referenceNodeForNode (node, allowsUnsafeAnchors) {
	if (!node) {
		return null;
	}
	if (isNodeAnchorable(node, allowsUnsafeAnchors)) {
		return node;
	}

	return referenceNodeForNode(node.parentNode, allowsUnsafeAnchors);
}


/* tested */
function makeRangeAnchorable (range, docElement) {
	if (!range) {
		throw new Error('Range cannot be null');
	}

	let startEdgeNode = nodeThatIsEdgeOfRange(range, true),
		endEdgeNode = nodeThatIsEdgeOfRange(range, false),
		newRange,
		startOffset = range.startOffset,
		endOffset = range.endOffset;

	//If both anchors are already anchorable, we are done here.
	if (endEdgeNode === range.endContainer &&
		startEdgeNode === range.startContainer &&
		isNodeAnchorable(startEdgeNode) &&
		isNodeAnchorable(endEdgeNode)) {
		return range;
	}

	//Clean up either end by looking for anchorable nodes inward or outward:
	if (!isNodeAnchorable(startEdgeNode)) {
		startEdgeNode = searchFromRangeStartInwardForAnchorableNode(startEdgeNode, range.commonAncestorContainer);
		startOffset = 0;
	}
	if (!isNodeAnchorable(endEdgeNode)) {
		endEdgeNode = searchFromRangeEndInwardForAnchorableNode(endEdgeNode);
		if (DOM.isTextNode(endEdgeNode)) {
			endOffset = endEdgeNode.nodeValue.length;
		}
	}

	//If we still have nothing, give up:
	if (!startEdgeNode || !endEdgeNode) {
		return null;
	}

	//If we get here, we got good nodes, figure out the best way to create the range now:
	newRange = createRange(docElement);

	//case 1: a single node
	if (startEdgeNode === endEdgeNode) {
		newRange.selectNode(startEdgeNode);
	}
	//case2: nodes are different, handle each:
	else {
		//start:
		if (DOM.isTextNode(startEdgeNode)) {
			newRange.setStart(startEdgeNode, startOffset);
		}
		else {
			newRange.setStartBefore(startEdgeNode);
		}
		//end:
		if (DOM.isTextNode(endEdgeNode)) {
			newRange.setEnd(endEdgeNode, endOffset);
		}
		else {
			newRange.setEndAfter(endEdgeNode);
		}
	}

	return newRange;
}


//TODO for these two methods consider skipping over any nodes with 'data-no-anchorable-children'
//as an optimization. (Probably minor since those are small parts of the tree right now)
//TODO provide an end we don't go past
/* tested */
function searchFromRangeStartInwardForAnchorableNode (startNode, commonParent) {
	if (!startNode) {
		return null;
	}

	let walker = document.createTreeWalker(commonParent, NodeFilter.SHOW_ALL, null, null);

	walker.currentNode = startNode;

	let temp = walker.currentNode;

	while (temp) {
		if (isNodeAnchorable(temp)) {
			return temp;
		}
		temp = walker.nextNode();
	}

	//if we got here, we found nada:
	return null;
}


/* tested */
//TODO provide a node we don't go past
function searchFromRangeEndInwardForAnchorableNode (endNode) {
	//handle simple cases where we can immediatly return
	if (!endNode) {
		return null;
	}
	if (isNodeAnchorable(endNode)) {
		return endNode;
	}

	endNode = walkDownToLastNode(endNode);

	function recurse(n) {
		if (!n) {
			return null;
		}
		if (isNodeAnchorable(n)) {
			return n;
		}

		let recurseOn = n;
		while (!recurseOn.previousSibling && recurseOn.parentNode) {
			recurseOn = recurseOn.parentNode;
		}

		if (!recurseOn.previousSibling) {
			return null;
		}
		recurseOn = recurseOn.previousSibling;
		recurseOn = walkDownToLastNode(recurseOn);

		return searchFromRangeEndInwardForAnchorableNode(recurseOn);
	}

	return recurse(endNode);
}


/* tested */
function walkDownToLastNode (node) {
	if (!node) {
		throw new Error('Node cannot be null');
	}

	let workingNode = node,
		result = workingNode;

	while (workingNode) {
		workingNode = workingNode.lastChild;
		if (workingNode) {
			result = workingNode;
		}
	}

	return result;
}


/* tested */
export function nodeThatIsEdgeOfRange (range, start) {
	if (!range) {
		throw new Error('Node is not defined');
	}

	let container = start ? range.startContainer : range.endContainer;
	let offset = start ? range.startOffset : range.endOffset;


	//If the container is a textNode look no further, that node is the edge
	if (DOM.isTextNode(container)) {
		return container;
	}

	if (start) {
		//If we are at the front of the range
		//the first full node in the range is the containers ith child
		//where i is the offset
		let cont = container.childNodes.item(offset);
		if (!cont) {
			return container;
		}
		if (DOM.isTextNode(cont) && cont.textContent.trim().length < 1) {
			return container;
		}
		return container.childNodes.item(offset);
	}

	//At the end the first fully contained node is
	//at offset-1
	if (offset < 1) {
		if (container.previousSibling) {
			return container.previousSibling;
		}
		while (!container.previousSibling && container.parentNode && offset !== 0) {
			container = container.parentNode;
		}

		if (!container.previousSibling) {
			//Ext.Error.raise('No possible node');
			return container;
		}
		return container.previousSibling;
	}
	return container.childNodes.item(offset - 1);
}


/* tested */
export function isNodeAnchorable (theNode, unsafeAnchorsAllowed) {
	//obviously not if node is not there
	if (!theNode) {
		return false;
	}

	function isNodeItselfAnchorable(node, allowUnsafeAnchors) {
		//distill the possible ids into an id var for easier reference later
		let id = node.id || (node.getAttribute ? node.getAttribute('id') : null),
			ntiid = node.getAttribute ? node.getAttribute('data-ntiid') : null,
			nonAnchorable = node.getAttribute ? node.getAttribute('data-non-anchorable') : false;

		if (nonAnchorable) {
			return false;
		}

		//Most common is text
		if (DOM.isTextNode(node)) {
			//We don't want to try to anchor to empty text nodes
			return node.nodeValue.trim().length > 0;
		}

		if (ntiid) {
			return true;
		}

		//no mathjax ids allowd
		if (id && id.indexOf('MathJax') !== -1) {
			return false;
		}

		//no extjs ids allowd
		if (id && id.indexOf('ext-gen') !== -1) {
			return false;
		}

		if (!allowUnsafeAnchors && id && /^a[0-9]*$/.test(id)) {
			return false; //ugly non reliable anchor
		}

		//If this node had an id and a tagName, then yay node!
		if (id && node.tagName) {
			return true;
		}

		//if not a text node, us it missing an id or a tagname?
		if (!id || !node.tagName) {
			return false;
		}

		//otherwise, assume not
		return false;
	}

	//If the itself is anchorable make sure its not in a parent
	//that claims nothing is anchorable
	if (isNodeItselfAnchorable(theNode, unsafeAnchorsAllowed)) {
		return !DOM.parent(theNode, '[' + NO_ANCHORABLE_CHILDREN_ATTRIBUTE + ']');
	}
	return false;
}


/* tested */
export function purifyRange (range, doc) {
	let docFrag,
		tempRange = createRange(doc),
		origStartNode = range.startContainer,
		origEndNode = range.endContainer,
		origStartOff = range.startOffset,
		origEndOff = range.endOffset,
		origStartModifiedOff = range.startOffset,
		origEndModifiedOff = range.endOffset,
		origStartEdgeNode = nodeThatIsEdgeOfRange(range, true),
		origEndEdgeNode = nodeThatIsEdgeOfRange(range, false),
		resultRange,
		ancestor = range.commonAncestorContainer,
		startEdge,
		endEdge,
		newStartOffset,
		newEndOffset;

	//make sure the common ancestor is anchorable, otherwise we have a problem, climb to one that is
	while (ancestor && (!isNodeAnchorable(ancestor) || DOM.isTextNode(ancestor))) {
		ancestor = ancestor.parentNode;
	}
	if (!ancestor) {
		throw new Error('No anchorable nodes in heirarchy');
	}

	//start by normalizing things, just to make sure it's normalized from the beginning:
	ancestor.normalize();
	//Ext.fly(ancestor).clean(); TODO - maybe clean and remove whitespace?

	//apply tags to start and end, note we use the edge nodes so
	//that we can recreate all the range info including the offset, not just the containers

	if (origStartEdgeNode !== origStartNode) {
		origStartModifiedOff = 0;
	}
	if (origEndEdgeNode !== origEndNode) {
		origEndModifiedOff = origEndEdgeNode.textContent.length;
	}


	tagNode(origStartEdgeNode, 'start', origStartModifiedOff);
	tagNode(origEndEdgeNode, 'end', (origStartEdgeNode === origEndEdgeNode) ? origEndModifiedOff + 33 : origEndModifiedOff);

	//setup our copy range
	tempRange.selectNode(ancestor);
	docFrag = tempRange.cloneContents();

	//return original range back to it's original form:
	cleanNode(origStartEdgeNode, 'start');
	cleanNode(origEndEdgeNode, 'end');
	range.setStart(origStartNode, origStartOff);
	range.setEnd(origEndNode, origEndOff);

	//clean the node of undesirable things:
	purifyNode(docFrag);

	//at this point we know the range ancestor is stored in the 'a' variable, now that the data is cleaned and
	//normalized, we need to find the range's start and end points, and create a fresh range.
	startEdge = findTaggedNode(docFrag, 'start');
	endEdge = findTaggedNode(docFrag, 'end');

	newStartOffset = cleanNode(startEdge, 'start');
	newEndOffset = cleanNode(endEdge, 'end');

	//build the new range divorced from the dom and return:
	resultRange = createRange(doc);
	if (!startEdge && !DOM.isTextNode(endEdge)) {
		resultRange.selectNodeContents(endEdge);
	}
	else {
		resultRange.selectNodeContents(docFrag);
		if (DOM.isTextNode(startEdge)) {
			resultRange.setStart(startEdge, newStartOffset);
		}
		else {
			resultRange.setStartBefore(startEdge);
		}

		if (DOM.isTextNode(endEdge)) {
			resultRange.setEnd(endEdge, newEndOffset);
		}
		else {
			resultRange.setEndAfter(endEdge);
		}
	}

	//for use whenever someone wants to know where this fits in the doc.
	resultRange.ownerNode = range.commonAncestorContainer.parentNode;
	return resultRange;
}


export function purifyNode (docFrag) {
	if (!docFrag) {
		throw new Error('must pass a node to purify.');
	}

	let parentContainer,
		nodeToInsertBefore;

	//remove any action or counter spans and their children:
	let remove = ['span.application-highlight.counter', 'span.redactionAction', 'span.blockRedactionAction'];

	for(let trash of remove) {
		for(let el of docFrag.querySelectorAll(trash)) {
			DOM.removeNode(el);
		}
	}

	//loop over elements we need to remove and, well, remove them:
	for(let n of docFrag.querySelectorAll('[data-non-anchorable]')) {
		if (n.parentNode) {
			parentContainer = n.parentNode;
			nodeToInsertBefore = n;
			for(let c of n.childNodes) {
				parentContainer.insertBefore(c, nodeToInsertBefore);
			}
		}
		else {
			throw new Error('Non-Anchorable node has no previous siblings or parent nodes.');
		}

		//remove non-anchorable node
		parentContainer.removeChild(nodeToInsertBefore);
	}

	//IE9 and older
	// function fallbackNormalize(node) {
	// 	var i = 0, nc = node.childNodes;
	// 	while (i < nc.length) {
	// 		while (DOM.isTextNode(nc[i]) && i + 1 < nc.length && DOM.isTextNode(nc[i + 1])) {
	// 			nc[i].data += nc[i + 1].data;
	// 			node.removeChild(nc[i + 1]);
	// 		}
	// 		fallbackNormalize(nc[i]);
	// 		i += 1;
	// 	}
	// }
	//
	// if (isIE9n) {
	// 	fallbackNormalize(docFrag);
	// }
	docFrag.normalize();
	return docFrag;
}


/* tested */
export function tagNode (node, tag, textOffset) {
	let attr = PURIFICATION_TAG,
			start, end;

	if (DOM.isTextNode(node)) {
		start = node.textContent.substring(0, textOffset);
		end = node.textContent.substring(textOffset);
		node.textContent = start + '[' + attr + ':' + tag + ']' + end;
	}
	else {
		node.setAttribute(attr + '-' + tag, 'true');
	}
}


/* tested */
export function cleanNode (node, tag) {
	let attr = PURIFICATION_TAG,
			tagSelector, offset;

	//generic protection:
	if (!node) {
		return null;
	}

	if (DOM.isTextNode(node)) {
		tagSelector = '[' + attr + ':' + tag + ']';
		offset = node.textContent.indexOf(tagSelector);
		if (offset >= 0) {
			node.textContent = node.textContent.replace(tagSelector, '');
		}
	}
	else {
		node.removeAttribute(attr + '-' + tag);
	}
	return offset;
}


/* tested */
export function findTaggedNode (root, tag) {
	let walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, null),
		attr = PURIFICATION_TAG,
		selector = '[' + attr + ':' + tag + ']',
		temp = root;

	while (temp) {
		if (DOM.isTextNode(temp)) {
			if (temp.textContent.indexOf(selector) >= 0) {
				return temp; //found it
			}
		}
		else if (temp.getAttribute) {
			let a = temp.getAttribute(attr + '-' + tag);
			if (a) {
				return temp;
			}

		}
		else {
			console.warn('skipping node while looking for tag', temp);
		}

		//advance:
		temp = walker.nextNode();
	}

	return null;
}


//TODO - testing
function toReferenceNodeXpathAndOffset (result) {
	//get a reference node that is NOT a text node...
	let referenceNode = referenceNodeForNode(result.node, true);
	while (referenceNode && DOM.isTextNode(referenceNode)) {
		referenceNode = referenceNodeForNode(referenceNode.parentNode, true);
	}
	if (!referenceNode) {
		throw new Error('Could not locate a valid ancestor');
	}

	//TODO - must be a Node, not txt?
	let referencePointer = new ElementDomContentPointer(null, null, {node: referenceNode, role: 'ancestor'});
	let adaptedResult = {
		referencePointer,
		offset: result.offset
	};

	if (result.node !== referenceNode) {
		let parts = [];
		let node = result.node;

		while (node && node !== referenceNode) {
			parts.push(indexInParentsChildren(node).toString());
			node = node.parentNode;
		}

		adaptedResult.xpath = parts.join('/');
	}

	return adaptedResult;
}


//TODO - testing
function indexInParentsChildren (node) {
	let i = 0;
	while ((node = node.previousSibling) !== null) {
		i++;
	}
	return i;
}


function convertStaticResultToLiveDomContainerAndOffset (staticResult, docElement) {
	if (!staticResult) {
		return null;
	}

	let body = docElement.body || findElementsWithTagName(docElement, 'body')[0] || docElement;
	let referenceNode = locateRangePointInAncestor(staticResult.referencePointer, body).node;

	if (!referenceNode) {
		return null;
	}

	referenceNode.normalize();

	if (!staticResult.xpath) {
		return {container: referenceNode};
	}

	let container = referenceNode;
	let parts = staticResult.xpath.split('/');
	let result;

	while (parts.length > 1) {

		if (DOM.isTextNode(container)) {
			console.error('Expected a non text node.  Expect errors', container);
		}

		let kids = container.childNodes;
		let part = parseInt(parts.pop(), 10);

		if (part >= kids.length) {
			console.error('Invalid xpath ' + staticResult.xpath + ' from node', referenceNode);
			return null;
		}

		result = ithChildAccountingForSyntheticNodes(container, part, null);
		container = result.container;
	}

	let lastPart = parseInt(parts.pop(), 10);
	result = ithChildAccountingForSyntheticNodes(container, lastPart, staticResult.offset);

	return result;
}


//TODO - testing
function ithChildAccountingForSyntheticNodes (node, idx, offset) {
	if (idx < 0 || !node.firstChild) {
		return null;
	}

	let childrenWithSyntheticsRemoved = childrenIfSyntheticsRemoved(node),
		i = 0,
		child,
		adjustedIdx = 0,
		result,
		textNode,
		limit;

	//Short circuit the error condition
	if (idx >= childrenWithSyntheticsRemoved.length) {
		return null;
	}

	//We assume that before synthetic nodes the dom was normalized
	//That means when iterating here we skip consecutive text nodes
	while (i < childrenWithSyntheticsRemoved.length) {
		child = childrenWithSyntheticsRemoved[i];

		if (adjustedIdx === idx) {
			break;
		}

		//If child is a textNode we want to advance to the last
		//nextnode adjacent to it.
		if (DOM.isTextNode(child)) {
			while (i < childrenWithSyntheticsRemoved.length - 1 && DOM.isTextNode(childrenWithSyntheticsRemoved[i + 1])) {
				i++;
			}
		}

		//Advance to the next child
		i++;
		adjustedIdx++;
	}

	if (!child || adjustedIdx !== idx) {
		return null;
	}

	//We've been asked to resolve an offset at the same time
	if (offset !== null) {
		//If the container isn't a text node, the offset is the ith child
		if (!DOM.isTextNode(child)) {
			result = {container: ithChildAccountingForSyntheticNodes(child, offset, null)};
			//console.log('Returning result from child is not textnode branch', result);
			return result;
		}

		while (i < childrenWithSyntheticsRemoved.length) {
			textNode = childrenWithSyntheticsRemoved[i];
			if (!DOM.isTextNode(textNode)) {
				break;
			}

			//Note <= range can be at the very end (equal to length)
			limit = textNode.textContent.length;
			if (offset <= limit) {
				result = {container: textNode, offset: offset};
				return result;
			}

			offset -= limit;
			i++;
		}

		console.error('Can`t find offset in joined textNodes');
		return null;

	}

	return {container: child};
}


//TODO -testing
//TODO - this can probably somehow be replaced with a purifiedNode call, rather than the logic that skips text nodes and subtracts offsets etc.
function childrenIfSyntheticsRemoved (node) {
	let sanitizedChildren = [], i,
		children = node.childNodes,
		child;

	if (DOM.matches(node, 'span.application-highlight.counter') ||
		DOM.matches(node, 'span.redactionAction') ||
		DOM.matches(node, 'span.blockRedactionAction')) {
		//ignore children:
		//console.log('ignoring children of', node, 'when finding non synthetic kids');
		return [];
	}

	for (i = 0; i < children.length; i++) {
		child = children[i];
		if (child.getAttribute && child.getAttribute('data-non-anchorable')) {
			sanitizedChildren = sanitizedChildren.concat(childrenIfSyntheticsRemoved(child));
		}
		else {
			sanitizedChildren.push(child);
		}
	}
	return sanitizedChildren;
}


/* tested */
export function cleanRangeFromBadStartAndEndContainers (range) {
	function isBlankTextNode(n) {
		return (DOM.isTextNode(n) && n.textContent.trim().length === 0);
	}

	let startContainer = range.startContainer,
		endContainer = range.endContainer,
		ancestor = DOM.isTextNode(range.commonAncestorContainer) ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer,
		txtNodes = DOM.getTextNodes(ancestor);


	if (isBlankTextNode(startContainer)) {
		console.log('found a range with a starting node that is nothing but whitespace');
		let index = txtNodes.indexOf(startContainer);
		for (let i = index; i < txtNodes.length; i++) {
			if (!isBlankTextNode(txtNodes[i])) {
				range.setStart(txtNodes[i], 0);
				break;
			}
		}
	}

	if (isBlankTextNode(endContainer)) {
		console.log('found a range with a end node that is nothing but whitespace');
		let index = txtNodes.indexOf(endContainer);
		for (let i = index; i >= 0; i--) {
			if (!isBlankTextNode(txtNodes[i])) {
				range.setEnd(txtNodes[i], txtNodes[i].textContent.length);
				break;
			}
		}
	}
	return range;
}


export function isMathChild (node) {
	if (!node) {
		return false;
	}
	if (!DOM.isTextNode(node) && DOM.hasClass(node, 'math')) {
		//top level math is not a math child :)
		return false;
	}

	return !!DOM.parent(node, '.math');
}


function getImmutableBlockParent (node) {
	let query = x => DOM.parent(node, `*:not(${x}) > ${x}`);

	let immutables = ['.math', '[data-reactid]']
		.map(query)
		.filter(x => x);


	return immutables.length <= 1
		? immutables[0]
		: immutables.reduce((a, b) => a.contains(b) ? a : b);
}


export function expandRangeToIncludeImmutableBlocks (range) {
	if (!range) {
		return null;
	}

	let start = getImmutableBlockParent(range.startContainer);
	let end = getImmutableBlockParent(range.endContainer);

	if (start) {
		range.setStartBefore(start);
	}

	if (end) {
		range.setEndAfter(end);
	}
}


export function expandSelectionToIncludeImmutableBlocks (sel) {
	let range = sel.getRangeAt(0);
	if (range) {
		sel.removeAllRanges();
		expandRangeToIncludeImmutableBlocks(range);
		sel.addRange(range);
	}

	return sel;
}
