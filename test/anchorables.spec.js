/*global document, window*/
import {isTextNode} from 'nti-lib-dom';
import {getModel} from 'nti-lib-interfaces';

if (typeof localStorage !== 'undefined') {
	localStorage.setItem('debug', '*');
}

const RealDomContentRangeDescription = getModel('contentrange.domcontentrangedescription');

const RealDomContentPointer = getModel('contentrange.domcontentpointer');
const RealElementDomContentPointer = getModel('contentrange.elementdomcontentpointer');
const RealTextDomContentPointer = getModel('contentrange.textdomcontentpointer');

const RealTextContext = getModel('contentrange.textcontext');


const isEmpty = x => x == null || x.length === 0;


class DomContentPointer extends RealDomContentPointer { constructor (o) { super(null, null, o); } }
class ElementDomContentPointer extends RealElementDomContentPointer { constructor (o) { super(null, null, o); } }
class TextDomContentPointer extends RealTextDomContentPointer { constructor (o) { super(null, null, o); } }
class DomContentRangeDescription extends RealDomContentRangeDescription { constructor (o) { super(null, null, o); } }
class TextContext extends RealTextContext { constructor (o) { super(null, null, o); } }

import {
	PURIFICATION_TAG,
	cleanNode,
	cleanRangeFromBadStartAndEndContainers,
	containsFullContext,
	createRangeDescriptionFromRange,
	createTextPointerFromRange,
	doesContentRangeDescriptionResolve,
	expandRangeToIncludeImmutableBlocks,
	findTaggedNode,
	firstWordFromString,
	generateAdditionalContext,
	generatePrimaryContext,
	getContainerNtiid,
	isMathChild,
	isNodeAnchorable,
	isNodeChildOfAncestor,
	lastWordFromString,
	locateElementDomContentPointer,
	locateRangeEdgeForAnchor,
	makeRangeAnchorable,
	nodeThatIsEdgeOfRange,
	purifyRange,
	referenceNodeForNode,
	resolveSpecBeneathAncestor,
	rootContainerIdFromDocument,
	scopedContainerNode,
	searchFromRangeEndInwardForAnchorableNode,
	searchFromRangeStartInwardForAnchorableNode,
	tagNode,
	toDomRange,
	walkDownToLastNode

} from '../src/index';


function addClass (element, cls) {
	element.classList.add(cls);
}

describe('Anchors', () => {

	let testBody;

	beforeEach(() => {
		testBody = document.createElement('div');
		testBody.classList.add('page-contents');
		document.body.appendChild(testBody);
	});

	afterEach(() => document.body.removeChild(testBody));

	describe('rootContainerIdFromDocument Tests', () => {
		it('Looks in meta tags', () => {
			let head, meta;
			expect(rootContainerIdFromDocument(document)).toBeFalsy();
			head = document.getElementsByTagName('head')[0];

			meta = document.createElement('meta');
			meta.setAttribute('name', 'NTIID');
			meta.setAttribute('content', 'foobar');
			head.appendChild(meta);

			expect(rootContainerIdFromDocument(document)).toBe('foobar');

			head.removeChild(meta);
		});
	});

	describe('getContainerNtiid', () => {
		it('resolves question node', () => {
			let question = document.createElement('object'),
				result;
			question.setAttribute('data-ntiid', 'foo');
			question.setAttribute('type', 'naquestion');

			testBody.appendChild(question);

			result = getContainerNtiid(question, null);

			expect(result).toEqual('foo');
		});

		it('resolves children of questions properly', () => {
			let question = document.createElement('object'),
				child = document.createElement('span'),
				result;
			question.setAttribute('data-ntiid', 'foo');
			question.setAttribute('type', 'naquestion');
			question.appendChild(child);

			testBody.appendChild(question);

			result = getContainerNtiid(child, null);

			expect(result).toEqual('foo');
		});

		it('ignores subcontainers that arent questions', () => {
			let container = document.createElement('div'),
				child = document.createElement('span'),
				result;
			container.setAttribute('data-ntiid', 'foo');
			container.appendChild(child);

			testBody.appendChild(container);

			result = getContainerNtiid(child, null);

			expect(result).toBeFalsy();
		});
	});

	describe('createRangeDescriptionFromRange Tests', () => {


		it('Create Description with non-anchorable', (done) => {
			const id = 'ThisIdIsTheBestest';
			const div = document.createElement('div');

			div.setAttribute('id', id);
			div.innerHTML = `
				<span id="a12312312" data-non-anchorable=true>
					<span class="a">text node 1<span>
					<br/>
					<span>text node 2</span>
					<span class="b"></span>
				</span>
			`;

			expect(div.children.length).toBe(1);

			testBody.appendChild(div);
			document.body.appendChild(testBody);

			function validate () {
				const a = document.querySelector('.a');
				const b = document.querySelector('.b');
				expect(a).toBeTruthy();
				expect(b).toBeTruthy();

				let range = document.createRange();
				range.setStartBefore(a);
				range.setEndAfter(b);

				expect(range.collapsed).toBeFalsy();
				expect(range.startOffset).toBe(1);
				expect(range.endOffset).toBe(6);

				const {description: result} = createRangeDescriptionFromRange(range, document);

				expect(result).toBeTruthy();

				expect(result.getAncestor().getElementId()).toEqual(id);
				done();
			}

			function check () {
				if (!document.querySelector(`#${id} .b`)) {
					return setTimeout(check, 100);
				}

				validate();
			}

			setTimeout(check, 100);
		});

		// it('Create Description with non-anchorable', () => {
		// 	let div = document.createElement('div'),
		// 		span = document.createElement('span'),
		// 		p = document.createElement('p'),
		// 		t1 = document.createTextNode('text node 1'),
		// 		span2 = document.createElement('span'),
		// 		p2 = document.createElement('p'),
		// 		t2 = document.createTextNode('text node 2'),
		// 		a = document.createElement('div'),
		// 		range, result;
		//
		// 	p2.appendChild(t2);
		// 	span2.appendChild(p2);
		// 	p.appendChild(t1);
		// 	span.appendChild(p);
		// 	span.appendChild(span2);
		// 	span.appendChild(a);
		// 	span.setAttribute('id', '12312312');
		// 	span.setAttribute('data-non-anchorable', 'true');
		// 	div.setAttribute('id', 'ThisIdIsTheBest');
		// 	div.appendChild(span);
		// 	testBody.appendChild(div);
		// 	document.body.appendChild(testBody);
		// 	range = document.createRange();
		// 	range.setStartBefore(p);
		// 	range.setEndAfter(a);
		//
		// 	result = createRangeDescriptionFromRange(range, document).description;
		// 	expect(result.getAncestor().getElementId()).toEqual(div.getAttribute('id'));
		// });

		it('Create Desciption from range of image with id', () => {
			let img = document.createElement('img'),
				span = document.createElement('span'),
				range, result;

			//set up img with data:
			span.setAttribute('id', 'sdfasdfsdfasd');
			img.setAttribute('id', '234234efjsdlkfjal2j4lkj');
			img.setAttribute('src', '#');

			span.appendChild(img);
			testBody.appendChild(span);

			range = document.createRange();
			range.selectNode(img);

			result = createRangeDescriptionFromRange(range, document);
			expect(result).toBeTruthy();
			expect(result.description).toBeTruthy();
			expect(result.description.getStart()).toBeTruthy();
			expect(result.description.getEnd()).toBeTruthy();
		});
	});

	describe('isNodeAnchorable Tests', () => {
		it('Null Node', () => {
			expect(isNodeAnchorable(null)).toBeFalsy();
		});

		it('Text Node with value', () => {
			let node = document.createTextNode('this is come text');
			expect(isNodeAnchorable(node)).toBeTruthy();
		});

		it('Text Node with empty value', () => {
			let node = document.createTextNode('');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});

		it('MathJax node', () => {
			let node = document.createElement('span');
			node.setAttribute('id', 'MathJax-blahblah');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});

		it('Node without Id', () => {
			let node = document.createElement('span');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});

		it('Anchor with name but no id', () => {
			let node = document.createElement('a');
			node.setAttribute('name', '00120323423');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});

		it('Anchor with invalidId id', () => {
			let node = document.createElement('a');
			node.setAttribute('id', 'a12309841');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});


		it('node with data-ntiid attr', () => {
			let node = document.createElement('div');
			node.setAttribute('data-ntiid', 'something-great');
			expect(isNodeAnchorable(node)).toBeTruthy();
		});

		it('Node with Id', () => {
			let node = document.createElement('span');
			node.setAttribute('id', '1234dfkdljl2j31lk3j');
			expect(isNodeAnchorable(node)).toBeTruthy();
		});

		it('Node with Id and data-non-anchorable Attribute', () => {
			let node = document.createElement('span');
			node.setAttribute('id', 'sddfkja;sfkje;ljr;3');
			node.setAttribute('data-non-anchorable', 'true');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});

		it('Node with Auto-Generated ExtJS Id Attribute', () => {
			let node = document.createElement('span');
			node.setAttribute('id', 'ext-gen1223423');
			expect(isNodeAnchorable(node)).toBeFalsy();
		});
	});

	describe('nodeThatIsEdgeOfRange Tests', () => {
		it('Null Range', () => {
			try {
				nodeThatIsEdgeOfRange(null, true);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Node is not defined');
			}
		});

		it('Range of Text Nodes, start and end', () => {
			let range = document.createRange(),
				txtNode1 = document.createTextNode('Text node 1'),
				txtNode2 = document.createTextNode('Text node 2');

			testBody.appendChild(txtNode1);
			testBody.appendChild(txtNode2);
			range.setStart(txtNode1, 5);
			range.setEnd(txtNode2, 5);

			expect(nodeThatIsEdgeOfRange(range, true).textContent).toEqual(txtNode1.textContent);
			expect(nodeThatIsEdgeOfRange(range, false).textContent).toEqual(txtNode2.textContent);
		});

		it('Range Without Children, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div');

			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 0);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('DIV');
		});

		it('Range Without Children, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div');

			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 0);

			expect(nodeThatIsEdgeOfRange(range, false).tagName).toEqual('DIV');
		});

		it('Range of Space Text Node, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				txtNode1 = document.createTextNode('  ');

			nonTxtNode1.appendChild(txtNode1);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 1);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('DIV');
		});

		it('Range of Space Text Node, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				txtNode1 = document.createTextNode('  ');

			nonTxtNode1.appendChild(txtNode1);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 1);

			expect(nodeThatIsEdgeOfRange(range, false)).toEqual(txtNode1);
		});

		it('Range of with Text Node, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				txtNode1 = document.createTextNode('text node');

			nonTxtNode1.appendChild(txtNode1);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 1);

			expect(nodeThatIsEdgeOfRange(range, true)).toEqual(txtNode1);
		});

		it('Range of with Text Node, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				txtNode1 = document.createTextNode('text node');

			nonTxtNode1.appendChild(txtNode1);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode1, 1);

			expect(nodeThatIsEdgeOfRange(range, false)).toEqual(txtNode1);
		});

		it('Range of Nodes, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('p'),
				nonTxtNode3 = document.createElement('span');

			nonTxtNode1.appendChild(nonTxtNode2);
			nonTxtNode1.appendChild(nonTxtNode3);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode3, 0);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('P');
		});

		it('Range of Nodes, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('p'),
				nonTxtNode3 = document.createElement('span');

			nonTxtNode1.appendChild(nonTxtNode2);
			nonTxtNode1.appendChild(nonTxtNode3);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode3, 0);

			expect(nodeThatIsEdgeOfRange(range, false).tagName).toEqual('P');
		});

		it('Range of Nested Nodes, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('span'),
				nonTxtNode3 = document.createElement('p');

			nonTxtNode2.appendChild(nonTxtNode3);
			nonTxtNode1.appendChild(nonTxtNode2);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode3, 0);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('SPAN');
		});

		it('Range of Nested Nodes, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('span'),
				nonTxtNode3 = document.createElement('p');

			nonTxtNode2.appendChild(nonTxtNode3);
			nonTxtNode1.appendChild(nonTxtNode2);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode3, 0);

			expect(nodeThatIsEdgeOfRange(range, false).tagName).toEqual('P');
		});

		it('Range of Node and Nested Node, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('a'),
				nonTxtNode3 = document.createElement('span'),
				nonTxtNode4 = document.createElement('p');

			nonTxtNode3.appendChild(nonTxtNode4);
			nonTxtNode1.appendChild(nonTxtNode2);
			nonTxtNode1.appendChild(nonTxtNode3);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode4, 0);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('A');
		});

		it('Range of Node and Nested Node, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('a'),
				nonTxtNode3 = document.createElement('span'),
				nonTxtNode4 = document.createElement('p');

			nonTxtNode3.appendChild(nonTxtNode4);
			nonTxtNode1.appendChild(nonTxtNode2);
			nonTxtNode1.appendChild(nonTxtNode3);
			testBody.appendChild(nonTxtNode1);
			range.setStart(nonTxtNode1, 0);
			range.setEnd(nonTxtNode4, 0);

			expect(nodeThatIsEdgeOfRange(range, false).tagName).toEqual('P');
		});

		it('Range of Non Text Nodes, start', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('span'),
				nonTxtNode3 = document.createElement('p'),
				txtNode1 = document.createTextNode('Text node 1'),
				txtNode2 = document.createTextNode('Text node 2');

			nonTxtNode1.appendChild(nonTxtNode3);
			nonTxtNode2.appendChild(txtNode1);
			nonTxtNode1.appendChild(nonTxtNode2);
			testBody.appendChild(nonTxtNode1);
			testBody.appendChild(txtNode2);
			range.setStart(nonTxtNode1, 1);
			range.setEnd(txtNode2, 5);

			expect(nodeThatIsEdgeOfRange(range, true).tagName).toEqual('SPAN');
		});

		it('Range of Non Text Nodes, end', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('span'),
				nonTxtNode3 = document.createElement('p'),
				txtNode1 = document.createTextNode('Text node 1'),
				txtNode2 = document.createTextNode('Text node 2');

			nonTxtNode1.appendChild(nonTxtNode3);
			nonTxtNode2.appendChild(txtNode1);
			nonTxtNode1.appendChild(nonTxtNode2);
			testBody.appendChild(txtNode2);
			testBody.appendChild(nonTxtNode1);
			range.setStart(txtNode2, 5);
			range.setEnd(nonTxtNode1, 2);

			expect(nodeThatIsEdgeOfRange(range, false).tagName).toEqual('SPAN');
		});


		it('Range of Mixed Nodes', () => {
			let range = document.createRange(),
				div = document.createElement('div'),
				p = document.createElement('p'),
				t = document.createTextNode('Text node');

			p.appendChild(t);
			div.appendChild(p);
			testBody.appendChild(div);

			range.setStart(p, 0);
			range.setEnd(t, 6);

			expect(isTextNode(nodeThatIsEdgeOfRange(range, true))).toBeTruthy();
			expect(nodeThatIsEdgeOfRange(range, true)).toBe(t);
		});


		it('Range of Non Text Nodes, negative offset', () => {
			let range = document.createRange(),
				nonTxtNode1 = document.createElement('div'),
				nonTxtNode2 = document.createElement('span'),
				nonTxtNode22 = document.createElement('span'),
				nonTxtNode3 = document.createElement('p'),
				txtNode1 = document.createTextNode('Text node 1'),
				txtNode2 = document.createTextNode('Text node 2');

			nonTxtNode22.setAttribute('test', 'test');
			nonTxtNode1.appendChild(nonTxtNode3);
			nonTxtNode2.appendChild(txtNode1);
			nonTxtNode1.appendChild(nonTxtNode22);
			nonTxtNode1.appendChild(nonTxtNode2);
			testBody.appendChild(txtNode2);
			testBody.appendChild(nonTxtNode1);
			range.setStart(txtNode2, 5);
			range.setEnd(nonTxtNode2, 0);

			expect(nodeThatIsEdgeOfRange(range, false).getAttribute('test')).toEqual('test');
		});
	});

	describe('searchFromRangeStartInwardForAnchorableNode Tests', () => {
		it('Null Node', () => {
			expect(searchFromRangeStartInwardForAnchorableNode(null)).toBeNull();
		});

		it('Already Anchorable Node', () => {
			let anchorable = document.createTextNode('This is a text node, yay'),
				result = searchFromRangeStartInwardForAnchorableNode(anchorable, anchorable);

			expect(result).toBe(anchorable);
		});

		it('Buried Anchorable text node', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				txt = document.createTextNode('This is text'),
				result;

			//setup heirarchy
			p.appendChild(txt);
			div.appendChild(p);

			result = searchFromRangeStartInwardForAnchorableNode(div, div);
			expect(result).toBe(txt);
		});

		it('Buried Anchorable non-text node', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				a = document.createElement('a'),
				result;

			//setup heirarchy
			a.setAttribute('id', '12345');
			p.appendChild(a);
			div.appendChild(p);

			result = searchFromRangeStartInwardForAnchorableNode(div, div);
			expect(result).toBe(a);
		});

		it('Buried Non Anchorable nodes', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				a = document.createElement('a'), //no id, not anchorable
				result;

			//setup heirarchy
			p.appendChild(a);
			div.appendChild(p);

			result = searchFromRangeStartInwardForAnchorableNode(div, div);
			expect(result).toBeNull();
		});

		it('Front digs up out and into sibling', () => {
			let div = document.createElement('div'),
				p1 = document.createElement('p'),
				redactionSpan = document.createElement('span'),
				innerRedactionSpan = document.createElement('span'),
				big = document.createElement('big'),
				replacementText = document.createTextNode('***'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('See spot run'),
				anchorableNode;

			big.appendChild(replacementText);
			innerRedactionSpan.appendChild(big);
			redactionSpan.setAttribute('data-no-anchors-within', true);
			redactionSpan.appendChild(innerRedactionSpan);
			p1.appendChild(redactionSpan);

			p2.appendChild(t2);

			div.appendChild(p1);
			div.appendChild(p2);
			testBody.appendChild(div);


			anchorableNode = searchFromRangeStartInwardForAnchorableNode(replacementText, div);
			expect(anchorableNode).toBe(t2);
		});

		it('Non Anchorable Node, Requires parent traversal', () => {
			let div = document.createElement('div'),
				s1 = document.createElement('span'),
				s2 = document.createElement('span'),
				t1 = document.createTextNode(' '),
				t2 = document.createTextNode('Anchorable Text Node'),
				result;

			//setup heirarchy
			s1.appendChild(t1);
			s2.appendChild(t2);
			div.appendChild(s1);
			div.appendChild(s2);

			result = searchFromRangeStartInwardForAnchorableNode(t1, div);
			expect(result).toBe(t2);
		});

		it('Interesting mathcounts case, firefox uses empty txt nodes', () => {
			/*
			<div id="a0000000044" class="naquestionpart naqsymmathpart">
				<a name="a0000000044">
					<span> What is the product of the digits of 7! ? </span>
				</a>
			</div>
			*/
			let div = document.createElement('div'),
				a = document.createElement('a'),
				s = document.createElement('span'),
				t = document.createTextNode(' What is the product of the digits of 7! ? '),
				// empty = document.createTextNode(' '),
				result;

			div.setAttribute('id', 'a0000000044');
			a.setAttribute('name', 'a0000000044');

			//setup heirarchy
			s.appendChild(t);
			a.appendChild(s);
			div.appendChild(a);
			div.appendChild(a);

			result = searchFromRangeStartInwardForAnchorableNode(div, div);
			expect(result).toBeTruthy();
			expect(result).toBe(t);
		});

	});

	describe('walkDownToLastNode Tests', () => {
		it('Null Node', () => {
			try {
				walkDownToLastNode(null);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Node cannot be null');
			}
		});

		it('Already At Bottom', () => {
			let bottom = document.createElement('a');
			expect(walkDownToLastNode(bottom)).toBe(bottom);
		});

		it('Several Layers Deep', () => {
			let n4 = document.createTextNode('Text Node'),
				n3 = document.createElement('p'),
				n2 = document.createElement('span'),
				n1 = document.createElement('div');

			n3.appendChild(n4);
			n2.appendChild(n3);
			n1.appendChild(n2);

			expect(walkDownToLastNode(n1)).toBe(n4);
		});

		it('Several Layers Deep With Siblings', () => {
			let n5 = document.createTextNode('More Text'),
				n4 = document.createTextNode('Text Node'),
				n4a = document.createElement('p'),
				n3 = document.createElement('p'),
				n3a = document.createElement('span'),
				n2 = document.createElement('span'),
				n1 = document.createElement('div');

			n1.appendChild(n2);
			n2.appendChild(n3);
			n3.appendChild(n4);
			n2.appendChild(n3a);
			n3a.appendChild(n4a);
			n4a.appendChild(n5);

			expect(walkDownToLastNode(n1)).toBe(n5);
		});
	});

	describe('isNodeChildOfAncestor Tests', () => {
		it('Node Not Ancestor Of Itself', () => {
			let d1 = document.createElement('div');
			let d2 = document.createElement('div');
			d1.appendChild(d2);
			expect(isNodeChildOfAncestor(d1, d1)).toBe(false);
		});
		it('Direct Parent-Child', () => {
			let d1 = document.createElement('div');
			let d2 = document.createElement('div');
			let d3 = document.createElement('div');
			d1.appendChild(d2);
			d2.appendChild(d3);
			expect(isNodeChildOfAncestor(d2, d1)).toBe(true);
			expect(isNodeChildOfAncestor(d3, d2)).toBe(true);
		});
		it('Grandparent and Beyond', () => {
			let d1 = document.createElement('div');
			let d2 = document.createElement('div');
			let d3 = document.createElement('div');
			let d4 = document.createElement('div');
			d1.appendChild(d2);
			d2.appendChild(d3);
			d3.appendChild(d4);
			expect(isNodeChildOfAncestor(d3, d1)).toBe(true);
			expect(isNodeChildOfAncestor(d4, d2)).toBe(true);
			expect(isNodeChildOfAncestor(d4, d1)).toBe(true);
		});
		it('Siblings and cousins don\'t match', () => {
			let d1 = document.createElement('div');
			let d2 = document.createElement('div');
			let d3 = document.createElement('div');
			let d4 = document.createElement('div');
			d1.appendChild(d2);
			d1.appendChild(d3);
			d3.appendChild(d4);
			expect(isNodeChildOfAncestor(d3, d2)).toBe(false);
			expect(isNodeChildOfAncestor(d4, d2)).toBe(false);
		});
		it('Backwards relationships don\'t match', () => {
			let d1 = document.createElement('div');
			let d2 = document.createElement('div');
			let d3 = document.createElement('div');
			d1.appendChild(d2);
			d2.appendChild(d3);
			expect(isNodeChildOfAncestor(d1, d2)).toBe(false);
			expect(isNodeChildOfAncestor(d2, d3)).toBe(false);
			expect(isNodeChildOfAncestor(d1, d3)).toBe(false);
		});
	});

	describe('searchFromRangeEndInwardForAnchorableNode Tests', () => {
		it('Null Node', () => {
			expect(searchFromRangeEndInwardForAnchorableNode(null)).toBeNull();
		});

		it('Already Anchorable Node', () => {
			let anchorable = document.createTextNode('This is a text node, yay'),
				result = searchFromRangeEndInwardForAnchorableNode(anchorable);

			expect(result).toBe(anchorable);
		});

		it('Buried Non Anchorable Node', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				a = document.createElement('a'), //no id, not anchorable
				result;

			//setup heirarchy
			p.appendChild(a);
			div.appendChild(p);

			result = searchFromRangeEndInwardForAnchorableNode(div);
			expect(result).toBeNull();
		});

		it('Buried Anchorable Node', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				p1 = document.createElement('p'),
				t1 = document.createTextNode('Textify!'),
				span2 = document.createElement('span'),
				div2 = document.createElement('div'),
				start = document.createElement('a');

			p1.appendChild(t1);
			span1.appendChild(p1);
			div2.appendChild(start);
			span2.appendChild(div2);
			div.appendChild(span1);
			div.appendChild(span2);

			expect(searchFromRangeEndInwardForAnchorableNode(start)).toBe(t1);
		});

		it('Walks Down Into Current Node', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				t1 = document.createTextNode('Foo'),
				span2 = document.createElement('span'),
				result;

			div.setAttribute('id', 'a1234');

			span1.appendChild(t1);
			div.appendChild(span1);
			div.appendChild(span2);

			testBody.appendChild(div);
			result = searchFromRangeEndInwardForAnchorableNode(span1);
			expect(result).toBe(t1);
		});

		it('End digs up out and into prior sibling', () => {
			let div = document.createElement('div'),
				p1 = document.createElement('p'),
				redactionSpan = document.createElement('span'),
				innerRedactionSpan = document.createElement('span'),
				big = document.createElement('big'),
				replacementText = document.createTextNode('***'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('See spot run'),
				anchorableNode;

			big.appendChild(replacementText);
			innerRedactionSpan.appendChild(big);
			redactionSpan.setAttribute('data-no-anchors-within', true);
			redactionSpan.appendChild(innerRedactionSpan);
			p1.appendChild(redactionSpan);

			p2.appendChild(t2);
			div.appendChild(p2);
			div.appendChild(p1);
			testBody.appendChild(div);


			anchorableNode = searchFromRangeEndInwardForAnchorableNode(replacementText, div);
			expect(anchorableNode).toBe(t2);
		});
	});

	describe('makeRangeAnchorable Tests', () => {
		it('Range Already Valid', () => {
			let div = document.createElement('div'),
				t1 = document.createTextNode('test node 1'),
				t2 = document.createTextNode('test node 2'),
				range, result;

			//make sure div is valid
			div.setAttribute('id', 'someid');

			//add this stuff to the body so we can then put it in a range
			div.appendChild(t1);
			div.appendChild(t2);
			testBody.appendChild(div);

			range = document.createRange();
			range.setStart(div, 0);
			range.setEnd(t2, 2);

			result = makeRangeAnchorable(range, document);
			expect(result.toString()).toBe(range.toString()); //should not have changed
		});

		it('Range Both Sides Need Digging', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('text node 1'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('text node 2'),
				a = document.createElement('div'),
				range, result;

			p2.appendChild(t2);
			span2.appendChild(p2);
			p.appendChild(t1);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStartBefore(p);
			range.setEndAfter(a);

			result = makeRangeAnchorable(range, document);

			expect(result.startContainer).toBe(t1);
			expect(result.startOffset).toEqual(0);
			expect(result.endContainer).toBe(t2);
			expect(result.endOffset).toEqual(11);
		});

		it('Front digs up out and into sibling', () => {
			let div = document.createElement('div'),
				p1 = document.createElement('p'),
				redactionSpan = document.createElement('span'),
				innerRedactionSpan = document.createElement('span'),
				big = document.createElement('big'),
				replacementText = document.createTextNode('***'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('See spot run'),
				range, anchorableRange;

			div.setAttribute('id', 'sdfgkljsdflkjslkcms');

			big.appendChild(replacementText);
			innerRedactionSpan.appendChild(big);
			redactionSpan.setAttribute('data-no-anchors-within', true);
			redactionSpan.appendChild(innerRedactionSpan);
			p1.appendChild(redactionSpan);

			p2.appendChild(t2);

			div.appendChild(p1);
			div.appendChild(p2);
			testBody.appendChild(div);

			range = document.createRange();
			range.setStart(replacementText, 1);
			range.setEnd(t2, t2.textContent.length);

			anchorableRange = makeRangeAnchorable(range, document);
			createRangeDescriptionFromRange(range, document);
			expect(anchorableRange).toBeTruthy();
			expect(anchorableRange.toString()).toEqual(t2.textContent);
		});

		it('Null Range', () => {
			try {
				makeRangeAnchorable(null, null);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('Range cannot be null');
			}
		});

		it('Range With NO Anchorables', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				a = document.createElement('a'),
				range, result;

			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStartBefore(p);
			range.setEndAfter(a);

			result = makeRangeAnchorable(range, document);
			expect(result).toBeNull();
		});
	});

	describe('referenceNodeForNode Tests', () => {
		it('Null Node', () => {
			expect(referenceNodeForNode(null)).toBeNull();
		});

		it('Node Already Anchorable', () => {
			let textNode = document.createTextNode('Scott Pilgram vs. The World');
			expect(referenceNodeForNode(textNode)).toBe(textNode);
		});

		it('Parent Node Anchorable', () => {
			let first = document.createElement('div'),
				second = document.createElement('span'),
				third = document.createElement('p');

			first.setAttribute('id', 'someid');
			second.appendChild(third);
			first.appendChild(second);

			expect(referenceNodeForNode(third)).toBe(first);
		});
	});

	describe('locateElementDomContentPointer Tests', () => {
		it('Null Pointer', () => {
			try {
				locateElementDomContentPointer(null, null, false);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('This method expects ElementDomContentPointers only');
			}
		});

		it('Wrong Node Type', () => {
			let domContentPointer = new DomContentPointer({role: 'start'});
			try {
				locateElementDomContentPointer(domContentPointer, null, null);
				this.fail('Not supposed to happen');
			}
			catch(e) {
				expect(e.message).toEqual('This method expects ElementDomContentPointers only');
			}
		});

		it('Contains Node, No After', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('text node 1'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('text node 2'),
				a = document.createElement('div'),
				pointer = new ElementDomContentPointer({role: 'start', elementTagName: 'p', elementId: 'SomeId'}),
				result = {};

			p2.appendChild(t2);
			span2.appendChild(p2);
			p.appendChild(t1);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			p2.setAttribute('id', 'SomeId');
			testBody.appendChild(div);

			result = locateElementDomContentPointer(pointer, div, {});
			expect(result.confidence).toEqual(1);
			expect(result.node).toBe(p2);
		});

		it('Contains Node, After', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('text node 1'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('text node 2'),
				a = document.createElement('div'),
				pointer = new ElementDomContentPointer({role: 'end', elementTagName: 'p', elementId: 'SomeId2'}),
				result = {};

			p.setAttribute('id', 'SomeId1');
			p2.appendChild(t2);
			span2.appendChild(p2);
			p.appendChild(t1);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			p2.setAttribute('id', 'SomeId2');
			testBody.appendChild(div);

			result = locateElementDomContentPointer(pointer, div, {node: span2});
			expect(result.confidence).toEqual(1);
			expect(result.node).toBe(p2);
		});

		it('Does Not Contain Node', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('text node 1'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('text node 2'),
				a = document.createElement('div'),
				pointer = new ElementDomContentPointer({role: 'start', elementTagName: 'p', elementId: 'SomeId'}),
				result = {};


			p2.appendChild(t2);
			span2.appendChild(p2);
			p.appendChild(t1);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);

			result = locateElementDomContentPointer(pointer, div, {node: span2});
			expect(result.confidence).toEqual(0);
			expect(result.node).toBeFalsy();
		});

		it('Correctly returns when root', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				t1 = document.createTextNode('text node 1'),
				result = {};

			p.setAttribute('id', 'SomeId');

			p.appendChild(t1);
			div.appendChild(p);
			testBody.appendChild(div);

			let pointer = new ElementDomContentPointer({node: p, role: 'start'});

			result = locateElementDomContentPointer(pointer, p, {});
			expect(result.confidence).toEqual(1);
			expect(result.node).toBe(p);
		});
	});

	describe('resolveSpecBeneathAncestor Tests', () => {
		it('Null Description', () => {
			try {
				resolveSpecBeneathAncestor(null, null, document);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Must supply Description');
			}
		});

		it('Null Doc Root', () => {
			try {
				resolveSpecBeneathAncestor(true, true, null);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Must supply a docElement');
			}
		});

		it('Good Description, ElementDomContentPointers Used', () => {
			let div1 = document.createElement('div'),
				div2 = document.createElement('div'),
				span = document.createElement('span'),
				t1 = document.createTextNode('This is text 1 '),
				t2 = document.createTextNode('This is text 2'),
				desc = new DomContentRangeDescription({
					start: new ElementDomContentPointer({
						role: 'start',
						elementTagName: 'div',
						elementId: 'Id1'
					}),
					end: new ElementDomContentPointer({
						role: 'end',
						elementTagName: 'div',
						elementId: 'Id2'
					}),
					ancestor: new ElementDomContentPointer({
						role: 'ancestor',
						elementTagName: 'SPAN',
						elementId: 'Span1'
					})
				}),
				result;

			div1.setAttribute('id', 'Id1');
			div2.setAttribute('id', 'Id2');
			span.setAttribute('id', 'Span1');
			div1.appendChild(t1);
			div2.appendChild(t2);
			span.appendChild(div1);
			span.appendChild(div2);

			testBody.appendChild(span);

			//send in doc.body for maximum workage
			result = resolveSpecBeneathAncestor(desc, document.body, document);
			expect(result.collapsed).toBe(false);
			expect(result.commonAncestorContainer).toBe(span);
			expect(result.toString()).toBe(span.textContent);
		});

		it('Good Description, TextDomContentPointers Used', () => {
			let div1 = document.createElement('div'),
				text1 = document.createTextNode('Text Node Number 1'),
				div2 = document.createElement('div'),
				text2 = document.createTextNode('Some Test Number 2'),
				span = document.createElement('span'),
				desc = new DomContentRangeDescription({
					start: new TextDomContentPointer({
						role: 'start',
						edgeOffset: 1,
						ancestor: new ElementDomContentPointer({
							role: 'ancestor',
							elementTagName: 'div',
							elementId: 'DivId1'
						}),
						contexts: [
							new TextContext({
								contextText: 'Node Number',
								contextOffset: 13
							})
						]
					}),
					end: new TextDomContentPointer({
						role: 'end',
						edgeOffset: 1,
						ancestor: new ElementDomContentPointer({
							role: 'ancestor',
							elementTagName: 'DIv', //just pass in weird caps, should not matter
							elementId: 'DivId2'
						}),
						contexts: [
							new TextContext({
								contextText: 'Test Number',
								contextOffset: 5
							})
						]
					}),
					ancestor: new ElementDomContentPointer({
						role: 'ancestor',
						elementTagName: 'SPAN',
						elementId: 'SpanId1'
					})
				}),
				result;

			div1.setAttribute('id', 'DivId1');
			div2.setAttribute('id', 'DivId2');
			span.setAttribute('id', 'SpanId1');
			div1.appendChild(text1);
			div2.appendChild(text2);
			span.appendChild(div1);
			span.appendChild(div2);

			testBody.appendChild(span);

			//send in doc.body for maximum workage
			result = resolveSpecBeneathAncestor(desc, document.body, document);
			expect(result.collapsed).toBe(false);
			expect(result.commonAncestorContainer).toBe(span);
			expect(result.startContainer).toBe(text1);
			expect(result.endContainer).toBe(text2);
		});

		it('Good Description Not Findable Nodes', () => {
			let desc = new DomContentRangeDescription({
					start: new ElementDomContentPointer({
						role: 'start',
						elementTagName: 'div',
						elementId: 'Id1xxx'
					}),
					end: new ElementDomContentPointer({
						role: 'end',
						elementTagName: 'div',
						elementId: 'Id2xxx'
					}),
					ancestor: new ElementDomContentPointer({
						role: 'ancestor',
						elementTagName: 'SPAN',
						elementId: 'Span1xxx'
					})
				}),
				result;

			//send in doc.body for maximum workage
			result = resolveSpecBeneathAncestor(desc, document.body, document);
			expect(result).toBeNull();
		});
	});

	describe('locateRangeEdgeForAnchor Tests', () => {
		it('Null Pointer', () => {
			try {
				locateRangeEdgeForAnchor(null, null);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('Must supply a Pointer');
			}
		});

		it('Invalid Pointer', () => {
			let pointer = new ElementDomContentPointer({
				role: 'start',
				elementTagName: 'div',
				elementId: '12345'
			});

			//send in doc.body for maximum workage
			try {
				locateRangeEdgeForAnchor(pointer, document.body);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('ContentPointer must be a TextDomContentPointer');
			}
		});

		it('Nothing Findable, No Start Result', () => {
			let pointer = new TextDomContentPointer({
					role: 'start',
					edgeOffset: 1,
					ancestor: new ElementDomContentPointer({
						role: 'ancestor',
						elementTagName: 'div',
						elementId: 'GobbleDeGook!!!'
					}),
					contexts: [
						new TextContext({
							contextText: 'Unfindable Text, Boogie Boo!!!',
							contextOffset: 19
						})
					]
				}),
				result;

			//send in doc.body for maximum workage
			result = locateRangeEdgeForAnchor(pointer, document.body);
			expect(result.confidence).toEqual(0);
		});
	});

	describe('firstWordFromString and lastWordFromString Tests', () => {
		it('lots of general tests', () => {
			expect(lastWordFromString('word')).toEqual('word');
			expect(firstWordFromString('word')).toEqual('word');

			expect(lastWordFromString('word1 word2')).toEqual('word2');
			expect(firstWordFromString('word1 word2')).toEqual('word1');

			expect(firstWordFromString('word1 word2 word3')).toEqual('word1');
			expect(lastWordFromString('word1 word2 word3')).toEqual('word3');

			expect(firstWordFromString('')).toEqual('');
			expect(lastWordFromString('')).toEqual('');

			try {
				lastWordFromString(null);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('Must supply a string');
			}

			try {
				firstWordFromString(null);
				expect(false).toBeTruthy();
			}
			catch (e) {
				expect(e.message).toEqual('Must supply a string');
			}
		});
	});

	describe('containsFullContext tests', () => {
		it('containsFullContext works fine', () => {
			function makeContexts (array) {
				let contexts = [];
				for (let i = 0; i < array.length; i++) {
					contexts.push({ contextText: array[i] });
				}
				let output = {};
				output.getContexts = () => contexts;
				return output;
			}
			let tests = [];
			tests.push(makeContexts(['front back', 'bob', 'ag', 'e', 'hippo', 'red']));
			tests.push(makeContexts(['front back', 'really', 'long', 'words']));
			tests.push(makeContexts(['front back', 'should', 'fail']));
			tests.push(makeContexts(['front back', 'f', 'a', 'i', 'l']));
			tests.push(makeContexts(['front back', 'su', 'cc', 'e', 'e', 'd']));
			tests.push(makeContexts(['front back']));
			tests.push(makeContexts([]));
			let outputs = [true, true, false, false, true, false, false];
			for (let i = 0; i < tests.length; i++) {
				expect(containsFullContext(tests[i])).toEqual(outputs[i]);
			}
		});
	});

	describe('generatePrimaryContext Tests', () => {
		it('Null Range', () => {
			try {
				generatePrimaryContext(null);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Range must not be null');
			}
		});

		it('No Text in Range', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				a = document.createElement('a'),
				range, result;

			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStartBefore(p);
			range.setEndAfter(a);

			result = generatePrimaryContext(range);
			expect(result).toBeNull();
		});

		it('Good Range', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t = document.createTextNode('This is some text'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('Also, this is more text'),
				a = document.createElement('a'),
				range, result;

			p.appendChild(t);
			p2.appendChild(t2);
			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStart(t, 3);
			range.setEnd(t, 6);

			result = generatePrimaryContext(range, 'start');
			expect(result.getContextText()).toEqual('This');
			expect(result.getContextOffset()).toEqual(17);
		});
	});

	describe('generateAdditionalContext', () => {
		it('Null Node', () => {
			try {
				generateAdditionalContext(null, 'start');
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Node must not be null');
			}
		});

		it('Non-Text Node', () => {
			expect(generateAdditionalContext(document.createElement('div'), 'start')).toBeNull();
		});

		it('Text Node', () => {
			let t = document.createTextNode('This is a text node, yay'),
				result1 = generateAdditionalContext(t, 'start'),
				result2 = generateAdditionalContext(t, 'end');

			expect(result1.getContextText()).toEqual('yay');
			expect(result2.getContextText()).toEqual('This');
			expect(result1.getContextOffset()).toEqual(3);
			expect(result2.getContextOffset()).toEqual(0);
		});
	});

	describe('createTextPointerFromRange Tests', () => {
		it('Null and Collapsed Ranges', () => {
			try {
				createTextPointerFromRange(null, 'start');
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Cannot proceed without range');
			}
		});

		it('Range Without Text Containers', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				a = document.createElement('a'),
				range;

			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStartBefore(p);
			range.setEndAfter(a);

			try {
				createTextPointerFromRange(range);
				expect(false).toBeTruthy();
			}
			catch(e) {
				expect(e.message).toEqual('Must supply an Id');
			}


		});

		it('Good Range', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('Once upon a time, there lived a BEAST!'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('The beasts name was, NextThoughtASaurus!'),
				a = document.createElement('a'),
				range, result;

			p.setAttribute('id', 'xzy1232314');
			p.appendChild(t1);
			p2.setAttribute('id', 'xzydasdasae2342');
			p2.appendChild(t2);
			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStart(t1, 3);
			range.setEnd(t2, 5);


			result = createTextPointerFromRange(range, 'end');
			expect(result).toBeTruthy();
			expect(result.getRole()).toEqual('end');
			expect(result.getAncestor().getElementId()).toEqual(p2.getAttribute('id'));
			expect(result.getContexts().length).toBeGreaterThan(0);
		});

		it('Skips empty text nodes when generating secondary contexts', () => {
			let div = document.createElement('div'),
				span = document.createElement('span'),
				p = document.createElement('p'),
				t1 = document.createTextNode('Once upon a time, there lived a BEAST!'),
				span2 = document.createElement('span'),
				p2 = document.createElement('p'),
				t2 = document.createTextNode('The beasts name was, NextThoughtASaurus!'),
				t3 = document.createTextNode(' '),
				em = document.createElement('em'),

				a = document.createElement('a'),
				range, result;

			p.setAttribute('id', 'xzy1232314');
			p.appendChild(t1);
			p2.setAttribute('id', 'xzydasdasae2342');
			p2.appendChild(t2);
			span2.appendChild(p2);
			span.appendChild(p);
			span.appendChild(span2);
			em.appendChild(t3);
			p2.appendChild(em);
			span.appendChild(a);
			div.appendChild(span);
			testBody.appendChild(div);
			range = document.createRange();
			range.setStart(t1, 3);
			range.setEnd(t2, 5);


			result = createTextPointerFromRange(range, 'end');
			expect(result).toBeTruthy();
			expect(result.getRole()).toEqual('end');
			expect(result.getAncestor().getElementId()).toEqual(p2.getAttribute('id'));
			expect(result.getContexts().length).toBeGreaterThan(0);

			let anyEmpty = false;
			for (let c of result.getContexts()) {
				if (isEmpty(c.contextText.trim())) {
					anyEmpty = true;
					return false;
				}
			}

			expect(anyEmpty).toEqual(false);
		});
	});

	describe('Range Putrification Tests', () => {
		it('Purify Range Test', () => {
			let p = document.createElement('p'),
				t1 = document.createTextNode('this is a text node, yay!	 go us!'),
				t2 = document.createTextNode('this is also a text node, yay!  go us!'),
				spanNoAnchors = document.createElement('span'),
				em = document.createElement('em'),
				t3 = document.createTextNode('This is more text actually, always more text'),
				span = document.createElement('span'),
				t4 = document.createTextNode('This is the final text'),
				pureRange, range;

			//add some stuff to span, clone it, add some more, see if it worked
			p.appendChild(t1);
			p.appendChild(t2);
			p.setAttribute('shouldBeThere', 'true');
			p.setAttribute('id', 'someRandomId');
			spanNoAnchors.setAttribute('data-non-anchorable', 'true');
			em.appendChild(t3);
			spanNoAnchors.appendChild(em);
			span.appendChild(t4);
			spanNoAnchors.appendChild(span);
			p.appendChild(spanNoAnchors);
			testBody.appendChild(p);

			//create the initial range:
			range = document.createRange();
			range.setStart(t1, 2);
			range.setEnd(t4, 6);

			//purify the range, the pureRange should not be associated with the old range, or it's contents:
			pureRange = purifyRange(range, document);

			//add more attrs to the old range's nodes
			p.setAttribute('shouldNOTBeThere', 'true'); //this should not be in the pureRange

			//do some checking of attrs to verify they are clones and not the same refs:
			expect(pureRange.commonAncestorContainer.getAttribute('shouldBeThere')).toBeTruthy();
			expect(pureRange.commonAncestorContainer.getAttribute('shouldNOTBeThere')).not.toBeTruthy();
			expect(range.toString()).toEqual(pureRange.toString()); //expect the range to encompass the same text
			expect(range.commonAncestorContainer.parentNode).toBe(pureRange.ownerNode);
		});

		it('Purify Range Where Ancestor is non-anchorable', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				t1 = document.createTextNode('this is a text node, yay!	 go us!'),
				t2 = document.createTextNode('this is also a text node, yay!  go us!'),
				spanNoAnchors = document.createElement('span'),
				em = document.createElement('em'),
				t3 = document.createTextNode('This is more text actually, always more text'),
				span = document.createElement('span'),
				t4 = document.createTextNode('This is the final text'),
				pureRange, range;

			//add some stuff to span, clone it, add some more, see if it worked
			p.setAttribute('data-non-anchorable', 'true');
			p.appendChild(t1);
			p.appendChild(t2);
			spanNoAnchors.setAttribute('data-non-anchorable', 'true');
			em.appendChild(t3);
			spanNoAnchors.appendChild(em);
			span.appendChild(t4);
			spanNoAnchors.appendChild(span);
			p.appendChild(spanNoAnchors);
			div.setAttribute('id', 'validId');
			div.appendChild(p);
			testBody.appendChild(div);

			//create the initial range:
			range = document.createRange();
			range.setStart(t1, 2);
			range.setEnd(t4, 6);

			//purify the range, the pureRange should not be associated with the old range, or it's contents:
			pureRange = purifyRange(range, document);

			//do some checking of attrs to verify they are clones and not the same refs:
			expect(range.toString()).toEqual(pureRange.toString()); //expect the range to encompass the same text
		});

		it('Purify Range Where Endpoints are elements', () => {
			let div = document.createElement('div'),
				p = document.createElement('p'),
				t1 = document.createTextNode('this is a text node, yay!	 go us!'),
				t2 = document.createTextNode('this is also a text node, yay!  go us!'),
				spanNoAnchors = document.createElement('span'),
				em = document.createElement('em'),
				t3 = document.createTextNode('This is more text actually, always more text'),
				span = document.createElement('span'),
				t4 = document.createTextNode('This is the final text'),
				pureRange, range;

			//add some stuff to span, clone it, add some more, see if it worked
			p.setAttribute('data-non-anchorable', 'true');
			p.appendChild(t1);
			p.appendChild(t2);
			spanNoAnchors.setAttribute('data-non-anchorable', 'true');
			em.appendChild(t3);
			spanNoAnchors.appendChild(em);
			span.appendChild(t4);
			spanNoAnchors.appendChild(span);
			p.appendChild(spanNoAnchors);
			div.setAttribute('id', 'validId');
			div.appendChild(p);
			testBody.appendChild(div);

			//create the initial range:
			range = document.createRange();
			range.setStart(spanNoAnchors, 0);
			range.setEnd(spanNoAnchors, 1);

			//purify the range, the pureRange should not be associated with the old range, or it's contents:
			pureRange = purifyRange(range, document);

			//do some checking of attrs to verify they are clones and not the same refs:
			expect(range.toString()).toEqual(pureRange.toString()); //expect the range to encompass the same text
		});

		it('Tagging and Cleaning Test', () => {
			let nodeWithNoAttr = document.createElement('span'),
				nodeWithAttr = document.createElement('span'),
				textNodeWithNoTag = document.createTextNode('this is some text'),
				textNodeWithTag = document.createTextNode('this is also text');

			//add stuff to nodes where needed:
			tagNode(nodeWithAttr, 'tagged');
			tagNode(textNodeWithTag, 'tagged-baby!');

			//check that things were tagged well:
			expect(nodeWithAttr.getAttribute(PURIFICATION_TAG + '-tagged')).toBeTruthy();
			expect(textNodeWithTag.textContent.indexOf(PURIFICATION_TAG)).toBeGreaterThan(-1);

			//cleanup and check results
			cleanNode(nodeWithNoAttr, 'x');
			cleanNode(nodeWithAttr, 'tagged');
			cleanNode(textNodeWithNoTag, 'x');

			cleanNode(textNodeWithTag, 'tagged-baby!');
			expect(nodeWithNoAttr.getAttribute(PURIFICATION_TAG + '-x')).toBeNull();
			expect(nodeWithAttr.getAttribute(PURIFICATION_TAG + '-tagged')).toBeNull();
			expect(textNodeWithNoTag.textContent.indexOf(PURIFICATION_TAG)).toEqual(-1);
			expect(textNodeWithTag.textContent.indexOf(PURIFICATION_TAG)).toEqual(-1);
		});

		it('Cleaning Text Node with Multiple Tags', () => {
			let text = 'You know [data-nti-purification-tag:start]how to add, subtract, multiply[data-nti-purification-tag:end], and divide. In fact, you may already know how to solve many of the problems in this chapter. So why do we start this book with an entire chapter on arithmetic?',
				expected = 'You know how to add, subtract, multiply, and divide. In fact, you may already know how to solve many of the problems in this chapter. So why do we start this book with an entire chapter on arithmetic?',
				textNode = document.createTextNode(text);

			cleanNode(textNode, 'end');
			cleanNode(textNode, 'start');

			expect(textNode.textContent).toEqual(expected);
		});

		it('Tag Finding Tests', () => {
			let p1 = document.createElement('p'),
				s1 = document.createElement('span'),
				p2 = document.createElement('p'),
				s2 = document.createElement('span'),
				t1 = document.createTextNode('once upon a time'),
				t2 = document.createTextNode(' there lived 3 bears'),
				textWithMultTags = document.createTextNode('some fancy text');


			//apply tags in some spots:
			tagNode(s1, 'tag1');
			tagNode(t1, 'tag2');
			tagNode(s2, 'tag3');
			tagNode(t2, 'tag4');
			tagNode(textWithMultTags, 'multi-tag1');
			tagNode(textWithMultTags, 'multi-tag2');

			//build dom heirarchy
			s2.appendChild(t2);
			p2.appendChild(t1);
			s1.appendChild(p2);
			s1.appendChild(s2);
			p1.appendChild(s1);

			expect(findTaggedNode(p1, 'tag1')).toBe(s1);
			expect(findTaggedNode(p1, 'tag2')).toBe(t1);
			expect(findTaggedNode(p1, 'tag3')).toBe(s2);
			expect(findTaggedNode(p1, 'tag4')).toBe(t2);
			expect(findTaggedNode(textWithMultTags, 'multi-tag1')).toBe(textWithMultTags);
			expect(findTaggedNode(textWithMultTags, 'multi-tag2')).toBe(textWithMultTags);

		});

		it('Purification Offset With Singular Text Node', () => {
			let p = document.createElement('p'),
				textNode = document.createTextNode('This is a single text node that exists inside a paragraph!	Can you believe that?'),
				pureRange, range;

			//add some stuff to span, clone it, add some more, see if it worked
			p.appendChild(textNode);
			p.setAttribute('id', 'someRandomId');
			testBody.appendChild(p);

			//create the initial range:
			range = document.createRange();
			range.setStart(textNode, 5);
			range.setEnd(textNode, 55);

			//purify the range, the pureRange should not be associated with the old range, or it's contents:
			pureRange = purifyRange(range, document);

			//do some checking of attrs to verify they are clones and not the same refs:
			expect(range.toString()).toEqual(pureRange.toString()); //expect the range to encompass the same text
			expect(range.commonAncestorContainer.parentNode).toBe(pureRange.ownerNode);
		});
	});

	describe('cleanRangeFromBadStartAndEndContainers Tests', () => {
		it('Clean Range of nodes with interleaved empty space nodes, start and end', () => {
			let li = document.createElement('li'),
				a = document.createElement('a'),
				s1 = document.createTextNode(' '),
				s2 = document.createTextNode(' '),
				s3 = document.createTextNode(' '),
				p = document.createElement('p'),
				t = document.createTextNode('an increase from 100 to 130 '),
				div = document.createElement('div'),
				range = document.createRange();

			//set up ids and heirarchy
			div.setAttribute('id', 'nti-content');
			li.setAttribute('id', 'a0000003697');
			a.setAttribute('name', '95faafa5cbec328f1283c2167db1a3de');
			p.setAttribute('id', '95faafa5cbec328f1283c2167db1a3de');
			p.appendChild(t);
			li.appendChild(s1);
			li.appendChild(a);
			li.appendChild(s2);
			li.appendChild(p);
			li.appendChild(s3);
			div.appendChild(li);
			testBody.appendChild(div);

			range.setStart(s1, 0);
			range.setEnd(t, 27);

			expect(cleanRangeFromBadStartAndEndContainers(range, true).startContainer).toEqual(t);
			expect(cleanRangeFromBadStartAndEndContainers(range, false).endContainer).toEqual(t);
		});

	});

	describe('isMathChild Tests', () => {
		it('Is Null', () => {
			expect(isMathChild(null)).toBeFalsy();
		});

		it('Is Math', () => {
			let elem = document.createElement('span');
			addClass(elem, 'math');
			expect(isMathChild(elem)).toEqual(false);
		});

		it('Is Not Math', () => {
			let elem = document.createElement('span');
			expect(isMathChild(elem)).toEqual(false);
		});

		it('Is Math Child', () => {
			let elem = document.createElement('span'),
				child = document.createElement('span'),
				text = document.createTextNode('math');

			addClass(elem, 'math');

			child.appendChild(text);
			elem.appendChild(child);

			expect(isMathChild(text)).toBe(true);
			expect(isMathChild(child)).toBe(true);
			expect(isMathChild(elem)).toBe(false);
		});
	});

	describe('expandRangeToIncludeImmutableBlocks Tests', () => {
		it('Null Range', () => {
			expect(expandRangeToIncludeImmutableBlocks(null)).toBeFalsy();
		});

		it('Range With No Math', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				text1 = document.createTextNode('Text 1'),
				mathDiv1 = document.createElement('div'),
				text2 = document.createTextNode('Text 2'),
				middleText = document.createTextNode('Middle Text'),
				mathDiv2 = document.createElement('div'),
				text3 = document.createTextNode('Text 3'),
				span2 = document.createElement('span'),
				text4 = document.createTextNode('Text 4'),
				range = document.createRange();

			span1.appendChild(text1);
			addClass(mathDiv1, 'math');
			mathDiv1.appendChild(text2);
			addClass(mathDiv2, 'math');
			mathDiv2.appendChild(text3);
			span2.appendChild(text4);
			div.appendChild(span1);
			div.appendChild(mathDiv1);
			div.appendChild(middleText);
			div.appendChild(mathDiv2);
			div.appendChild(span2);
			testBody.appendChild(div);

			range.setStart(text1, 0);
			range.setEnd(text4, 1);

			expandRangeToIncludeImmutableBlocks(range);
			expect(range.commonAncestorContainer).toBe(div);
			expect(range.startContainer).toBe(text1);
			expect(range.endContainer).toBe(text4);
		});

		it('Range With Start Math Child', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				text1 = document.createTextNode('Text 1'),
				mathDiv1 = document.createElement('div'),
				text2 = document.createTextNode('Text 2'),
				middleText = document.createTextNode('Middle Text'),
				mathDiv2 = document.createElement('div'),
				text3 = document.createTextNode('Text 3'),
				span2 = document.createElement('span'),
				text4 = document.createTextNode('Text 4'),
				range = document.createRange();

			span1.appendChild(text1);
			addClass(mathDiv1, 'math');
			mathDiv1.appendChild(text2);
			addClass(mathDiv2, 'math');
			mathDiv2.appendChild(text3);
			span2.appendChild(text4);
			div.appendChild(span1);
			div.appendChild(mathDiv1);
			div.appendChild(middleText);
			div.appendChild(mathDiv2);
			div.appendChild(span2);
			testBody.appendChild(div);

			range.setStart(text2, 2);
			range.setEnd(text4, 2);

			expandRangeToIncludeImmutableBlocks(range);

			expect(range.commonAncestorContainer).toBe(div);
			expect(range.startContainer).toBe(div);
			expect(range.startOffset).toBe(1);
			expect(range.endContainer).toBe(text4);
		});

		it('Range With End Math', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				text1 = document.createTextNode('Text 1'),
				mathDiv1 = document.createElement('div'),
				text2 = document.createTextNode('Text 2'),
				middleText = document.createTextNode('Middle Text'),
				mathDiv2 = document.createElement('div'),
				text3 = document.createTextNode('Text 3'),
				span2 = document.createElement('span'),
				text4 = document.createTextNode('Text 4'),
				range = document.createRange();

			span1.appendChild(text1);
			addClass(mathDiv1, 'math');
			mathDiv1.appendChild(text2);
			addClass(mathDiv2, 'math');
			mathDiv2.appendChild(text3);
			span2.appendChild(text4);
			div.appendChild(span1);
			div.appendChild(mathDiv1);
			div.appendChild(middleText);
			div.appendChild(mathDiv2);
			div.appendChild(span2);
			testBody.appendChild(div);

			range.setStart(text1, 0);
			range.setEnd(text3, 1);

			expandRangeToIncludeImmutableBlocks(range);
			expect(range.commonAncestorContainer).toBe(div);
			expect(range.startContainer).toBe(text1);
			expect(range.endContainer).toBe(div);
			expect(range.endOffset).toBe(4);
		});

		it('Range With Both Start and End Math', () => {
			let div = document.createElement('div'),
				span1 = document.createElement('span'),
				text1 = document.createTextNode('Text 1'),
				mathDiv1 = document.createElement('div'),
				text2 = document.createTextNode('Text 2'),
				middleText = document.createTextNode('Middle Text'),
				mathDiv2 = document.createElement('div'),
				text3 = document.createTextNode('Text 3'),
				span2 = document.createElement('span'),
				text4 = document.createTextNode('Text 4'),
				range = document.createRange();

			span1.appendChild(text1);
			addClass(mathDiv1, 'math');
			mathDiv1.appendChild(text2);
			addClass(mathDiv2, 'math');
			mathDiv2.appendChild(text3);
			span2.appendChild(text4);
			div.appendChild(span1);
			div.appendChild(mathDiv1);
			div.appendChild(middleText);
			div.appendChild(mathDiv2);
			div.appendChild(span2);
			testBody.appendChild(div);

			range.setStart(text2, 0);
			range.setEnd(text3, 1);

			expandRangeToIncludeImmutableBlocks(range);
			expect(range.commonAncestorContainer).toBe(div);
			expect(range.startContainer).toBe(div);
			expect(range.startOffset).toBe(1);
			expect(range.endContainer).toBe(div);
			expect(range.endOffset).toBe(4);

		});
	});

	describe('expandSelectionBy Tests', () => {
		it('Test It', () => {
			let pretext = document.createTextNode('This is some text that belongs before my div'),
				posttext = document.createTextNode('This is some text that belongs after my div'),
				div = document.createElement('div'),
				span1 = document.createElement('span'),
				text1 = document.createTextNode('Text 1'),
				mathDiv1 = document.createElement('div'),
				text2 = document.createTextNode('Text 2'),
				middleText = document.createTextNode('Middle Text'),
				mathDiv2 = document.createElement('div'),
				text3 = document.createTextNode('Text 3'),
				span2 = document.createElement('span'),
				text4 = document.createTextNode('Text 4'),
				range,
				sel;

			span1.appendChild(text1);
			addClass(mathDiv1, 'math');
			mathDiv1.appendChild(text2);
			addClass(mathDiv2, 'math');
			mathDiv2.appendChild(text3);
			span2.appendChild(text4);
			div.appendChild(span1);
			div.appendChild(mathDiv1);
			div.appendChild(middleText);
			div.appendChild(mathDiv2);
			div.appendChild(span2);
			testBody.appendChild(pretext);
			testBody.appendChild(div);
			testBody.appendChild(posttext);

			range = document.createRange();

			sel = window.getSelection();
			range.setStart(text2, 2);
			range.setEnd(text4, 2);
			sel.removeAllRanges();
			sel.addRange(range);

			//TODO - check expansion code in Main.js
			// expandSelectionBy(sel, 50, true);


			// expect(sel.toString().indexOf('is some text that belongs before my div')).toBe(0);
			// expect(sel.toString().indexOf('This is some text that belongs after my div')).toBe(80);
		});
	});

	describe('Empty range description optimization tests', () => {
		it('Produce empty descriptions for null ranges', () => {
			let empty = createRangeDescriptionFromRange(null, document);
			expect(empty).toBeTruthy();
			expect(empty.getAncestor).toBe(undefined);
			expect(empty.getStart).toBe(undefined);
			expect(empty.getEnd).toBe(undefined);
		});

		it('Wraps the container for empty ranges', () => {
			let emptyDesc = createRangeDescriptionFromRange(null, document),
				root = document.createElement('div'), //this should be the ancestor
				p1 = document.createElement('p'),
				t1 = document.createTextNode('This is some text.'), //same as t2
				p2 = document.createElement('p'),
				t2 = document.createTextNode('This is some text.'),
				recreatedRange;

			//set up ids and heirarchy
			p1.setAttribute('position', 1);
			p1.appendChild(t1);
			p2.setAttribute('position', 2);
			p2.appendChild(t2);
			root.appendChild(p1);
			root.appendChild(p2);
			testBody.appendChild(root);

			recreatedRange = toDomRange(emptyDesc.description, document, document.body.parentNode, null, 'foo');
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.commonAncestorContainer).toBe(document.body.parentNode);

			root.setAttribute('id', '123242354543523');
			recreatedRange = toDomRange(emptyDesc.description, document, document.body.parentNode, '123242354543523', 'pagecontainer');
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.commonAncestorContainer).toBe(root.parentNode);
		});

	});

	describe('Integration Tests', () => {
		//TODO - write a unit test for 3 identical txt nodes where the anchor ends on teh end of the second
		it('Ancestor Spanning Identical Text Node Bug', () => {
			let root = document.createElement('div'), //this should be the ancestor
				p1 = document.createElement('p'),
				t1 = document.createTextNode('This is some text.'), //same as t2
				p2 = document.createElement('p'),
				t2 = document.createTextNode('This is some text.'),
				range, desc, recreatedRange;

			//set up ids and heirarchy
			root.setAttribute('id', '123242354543523');
			p1.setAttribute('position', 1);
			p1.appendChild(t1);
			p2.setAttribute('position', 2);
			p2.appendChild(t2);
			root.appendChild(p1);
			root.appendChild(p2);
			testBody.appendChild(root);

			//create a range now starting at the first char of t1 and the last of t2
			range = document.createRange();
			range.setStart(t1, 0);
			range.setEnd(t2, t2.length);

			//double check that my range has different nodes and is set up correctly
			expect(range.startContainer).toBe(t1);
			expect(range.endContainer).toBe(t2);
			expect(t1).not.toBe(t2);
			expect(range.startContainer).not.toBe(range.endContainer);
			expect(range.toString()).toEqual(t1.textContent + t2.textContent);

			//now turn that into a description, and check a few assumptions
			desc = createRangeDescriptionFromRange(range, document).description;
			expect(desc).toBeTruthy();
			expect(desc.getAncestor()).toBeTruthy();
			expect(desc.getAncestor().getElementId()).toEqual(root.getAttribute('id'));

			//now round trip back to a range, verify that it is the same range as before
			recreatedRange = toDomRange(desc, document, document.body);
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.startContainer).toBe(range.startContainer);
			expect(recreatedRange.endContainer).toBe(range.endContainer);
			expect(recreatedRange.commonAncestorContainer).toBe(range.commonAncestorContainer);
		});

		it('Ancestor Spanning Identical Text Node Bug with data-ntiids', () => {
			let root = document.createElement('div'), //this should be the ancestor
				p1 = document.createElement('p'),
				t1 = document.createTextNode('This is some text.'), //same as t2
				p2 = document.createElement('p'),
				t2 = document.createTextNode('This is some text.'),
				range, desc, recreatedRange;

			//set up ids and heirarchy
			root.setAttribute('data-ntiid', 'tag:nextthought.com,2011-123242354543523'); //Note this needs to look like an ntiid
			p1.setAttribute('position', 1);
			p1.appendChild(t1);
			p2.setAttribute('position', 2);
			p2.appendChild(t2);
			root.appendChild(p1);
			root.appendChild(p2);
			testBody.appendChild(root);

			//create a range now starting at the first char of t1 and the last of t2
			range = document.createRange();
			range.setStart(t1, 0);
			range.setEnd(t2, t2.length);

			//double check that my range has different nodes and is set up correctly
			expect(range.startContainer).toBe(t1);
			expect(range.endContainer).toBe(t2);
			expect(t1).not.toBe(t2);
			expect(range.startContainer).not.toBe(range.endContainer);
			expect(range.toString()).toEqual(t1.textContent + t2.textContent);

			//now turn that into a description, and check a few assumptions
			desc = createRangeDescriptionFromRange(range, document).description;
			expect(desc).toBeTruthy();
			expect(desc.getAncestor()).toBeTruthy();
			expect(desc.getAncestor().getElementId()).toEqual(root.getAttribute('data-ntiid'));

			//now round trip back to a range, verify that it is the same range as before
			recreatedRange = toDomRange(desc, document, document.body);
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.startContainer).toBe(range.startContainer);
			expect(recreatedRange.endContainer).toBe(range.endContainer);
			expect(recreatedRange.commonAncestorContainer).toBe(range.commonAncestorContainer);
		});


		it('Ambigious Model Causing Incorrect Highlight Bug', () => {
			/*
			From the documentation:, this does not highlight correctly
			<p id="id">
					[|This is a sentence]
					<b class="bfseries"><em>WOW</em></b>
					[. Another sentence]<em>YIKES</em>[ and ]<em>foo</em>[. |]
			</p>
			*/
			//declare our elements and nodes and stuff:
			let p = document.createElement('p'),
				t1 = document.createTextNode('This is a sentence'),
				b = document.createElement('b'),
				em1 = document.createElement('em'),
				t2 = document.createTextNode('WOW'),
				t3 = document.createTextNode('. Another sentence'),
				em2 = document.createElement('em'),
				t4 = document.createTextNode('YIKES'),
				t5 = document.createTextNode(' and '),
				em3 = document.createElement('em'),
				t6 = document.createTextNode('foo'),
				t7 = document.createTextNode('. '),
				range, desc, recreatedRange,
				expectedRangeToString = 'This is a sentenceWOW. Another sentenceYIKES and foo. ';

			//setup ids and heirarchies:
			p.setAttribute('id', 'id');
			b.setAttribute('class', 'bfseries');
			//fill up ems
			em3.appendChild(t6);
			em2.appendChild(t4);
			em1.appendChild(t2);
			//fill up bold tag
			b.appendChild(em1);
			//put the rest under the paragraph
			p.appendChild(t1);
			p.appendChild(b);
			p.appendChild(t3);
			p.appendChild(em2);
			p.appendChild(t5);
			p.appendChild(em3);
			p.appendChild(t7);
			//now put the paragraph in the body
			testBody.appendChild(p);

			//okay, whew, now create the range described in the docs
			range = document.createRange();
			range.setStart(t1, 0);
			range.setEnd(t7, t7.length);

			//verify assumptions
			expect(range).toBeTruthy();
			expect(range.startContainer).toBe(t1);
			expect(range.endContainer).toBe(t7);
			expect(range.commonAncestorContainer).toBe(p);
			expect(range.toString()).toEqual(expectedRangeToString);

			//now turn that into a description, and check a few assumptions
			desc = createRangeDescriptionFromRange(range, document).description;
			expect(desc).toBeTruthy();
			expect(desc.getAncestor()).toBeTruthy();
			expect(desc.getAncestor().getElementId()).toEqual(p.getAttribute('id'));

			//now round trip back to a range, verify that it is the same range as before
			recreatedRange = toDomRange(desc, document, document.body);
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.startContainer).toBe(range.startContainer);
			expect(recreatedRange.endContainer).toBe(range.endContainer);
			expect(recreatedRange.commonAncestorContainer).toBe(range.commonAncestorContainer);
			expect(recreatedRange.toString()).toEqual(expectedRangeToString);
		});

		it('Weird line in an li does not result in good resolution', () => {
			/*
			<li class="part" id="a0000003697" partnum="(a)">
				<a name="95faafa5cbec328f1283c2167db1a3de"></a>
				<p class="par" id="95faafa5cbec328f1283c2167db1a3de">an increase from 100 to 130 </p>
			</li>
			 */


			let li = document.createElement('li'),
				a = document.createElement('a'),
				s1 = document.createTextNode(' '),
				s2 = document.createTextNode(' '),
				s3 = document.createTextNode(' '),
				p = document.createElement('p'),
				t = document.createTextNode('an increase from 100 to 130 '),
				div = document.createElement('div'),
				range, desc, recreatedRange;

			//set up ids and heirarchy
			div.setAttribute('id', 'nti-content');
			li.setAttribute('id', 'a0000003697');
			a.setAttribute('name', '95faafa5cbec328f1283c2167db1a3de');
			p.setAttribute('id', '95faafa5cbec328f1283c2167db1a3de');
			p.appendChild(t);
			li.appendChild(s1);
			li.appendChild(a);
			li.appendChild(s2);
			li.appendChild(p);
			li.appendChild(s3);
			div.appendChild(li);
			testBody.appendChild(div);

			//create a range now starting at the first char of t1 and the last of t2
			range = document.createRange();
			range.setStart(s1, 0);
			range.setEnd(t, 27);

			//now turn that into a description, and check a few assumptions
			desc = createRangeDescriptionFromRange(range, document).description;
			expect(desc).toBeTruthy();
			expect(desc.getAncestor()).toBeTruthy();

			//now round trip back to a range, verify that it is the same range as before
			recreatedRange = toDomRange(desc, document, document.body);
			expect(recreatedRange).toBeTruthy();
			expect(recreatedRange.startContainer).toBe(range.startContainer);
			expect(recreatedRange.endContainer).toBe(range.endContainer);
			expect(recreatedRange.commonAncestorContainer).toBe(range.commonAncestorContainer);
		});
	});

	describe('scopeContainerId', () => {
		it('searches within the body when rootId and containerId are equal.', () => {
			let mainNode = document.createElement('div'),
				pageContent = document.createElement('div'),
				footNotesContent = document.createElement('div'),
				footnotes = document.createElement('ol'),
				rootId, head, meta, searchWithin,
				containerId = 'tag:nextthought.com,2011-10:Columbia-HTML-Great_Leader_Essays.biography.4';

			//Setup the page ntiid meta tag.
			expect(rootContainerIdFromDocument(document)).toBeFalsy();
			head = document.getElementsByTagName('head')[0];
			meta = document.createElement('meta');
			meta.setAttribute('name', 'NTIID');
			meta.setAttribute('content', containerId);
			head.appendChild(meta);

			//Check to see if the rootId is equal to the containerId
			rootId = rootContainerIdFromDocument(document);
			expect(rootId).toBeTruthy();
			expect(rootId).toEqual(containerId);


			//Build the page content
			mainNode.setAttribute('id', 'nti-content');
			pageContent.setAttribute('data-ntiid', containerId);
			pageContent.setAttribute('id', 'a0000000050');
			footNotesContent.setAttribute('id', 'footnotes');

			footNotesContent.appendChild(footnotes);
			mainNode.appendChild(pageContent);
			mainNode.appendChild(footNotesContent);
			testBody.appendChild(mainNode);

			//Check the scope container.
			searchWithin = scopedContainerNode( testBody, containerId, rootId);
			expect(searchWithin).not.toBe(pageContent);
			expect(searchWithin).toBe(testBody);

		});

		it('searches within the fragment node when the containerId is not provided', () => {
			let mainNode = document.createElement('div'),
				pageContent = document.createElement('div'),
				rootId, searchWithin;

			//We expect the rootId to valid because the ntiid
			expect(rootContainerIdFromDocument(document)).toBeTruthy();
			rootId = rootContainerIdFromDocument(document);

			//Build the page content
			mainNode.setAttribute('id', 'nti-content');
			pageContent.setAttribute('id', 'a0000000050');
			pageContent.setAttribute('data-ntiid', 'foobar');

			mainNode.appendChild(pageContent);
			testBody.appendChild(mainNode);

			//Check the scope container.
			searchWithin = scopedContainerNode( pageContent, null, rootId);
			expect(searchWithin).not.toBe(testBody);
			expect(searchWithin).toBe(pageContent);
		});

		it('looks for the containerNode when the containerId and rootId are different', () => {
			let mainNode = document.createElement('div'),
				pageContent = document.createElement('div'),
				containerId = 'tag:nextthought.com,2011-10:Columbia-HTML-Great_Leader_Essays.biography.3',
				rootId, searchWithin;

			//Check to see if the rootId is equal to the containerId
			rootId = rootContainerIdFromDocument(document);

			//Build the page content
			mainNode.setAttribute('id', 'nti-content');
			pageContent.setAttribute('id', 'a0000000050');
			pageContent.setAttribute('data-ntiid', 'tag:nextthought.com,2011-10:Columbia-HTML-Great_Leader_Essays.biography.3');

			mainNode.appendChild(pageContent);
			testBody.appendChild(mainNode);

			//Check the scope container.
			// TODO: test not done. can't the searchWithin let is null, needs to do better setup.
			searchWithin = scopedContainerNode( pageContent, containerId, rootId);
			expect(searchWithin).not.toBe(testBody);
			expect(searchWithin).not.toBe(pageContent);
			expect(searchWithin).toBeNull();
		});
	});

	describe('doesContentRangeDescriptionResolve', () => {
		it('Works for things like slides', () => {
			let div = document.createElement('div'),
				childDiv = document.createElement('div'),
				anotherDiv = document.createElement('div'),

				ancestor = new ElementDomContentPointer({role: 'ancestor', elementTagName: 'div', elementId: 'parent'}),
				start = new ElementDomContentPointer({role: 'start', elementTagName: 'div', elementId: 'child'}),
				end = new ElementDomContentPointer({role: 'end', elementTagName: 'div', elementId: 'child'}),

				desc = new DomContentRangeDescription({start, end, ancestor});

			anotherDiv.setAttribute('id', 'thisIsNotTheDivYouSeek');
			div.setAttribute('id', 'parent');
			childDiv.setAttribute('id', 'child');
			div.appendChild(childDiv);
			testBody.appendChild(anotherDiv);
			testBody.appendChild(div);

			let result = doesContentRangeDescriptionResolve(desc, div);
			expect(result).toBeTruthy();
			desc.attachLocator(null);
			result = doesContentRangeDescriptionResolve(desc, anotherDiv);
			expect(result).toBeFalsy();
		});
	});
});
