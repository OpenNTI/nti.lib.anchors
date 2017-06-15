/*globals document, NodeFilter */
/* eslint-env jest */
import {
	createRangeDescriptionFromRange,
	getCurrentNodeMatches,
	locateRangeEdgeForAnchor,
	toDomRange
} from '../index';

describe('Tests with Changing Documents', ()=> {

	let testBody;


	beforeEach(() => {
		testBody = document.createElement('div');
		document.body.appendChild(testBody);
	});


	afterEach(() => document.body.removeChild(testBody));


	function addElement (daddy, tag, attrs) {
		let sonny = document.createElement(tag);

		for (let a of Object.keys(attrs)) {
			sonny.setAttribute(a, attrs[a]);
		}

		if (daddy) {
			daddy.appendChild(sonny);
		}
		return sonny;
	}


	function insertElement (daddy, bigBrother, tag, attrs) {
		let sonny = document.createElement(tag);
		for (let a of Object.keys(attrs)) { sonny.setAttribute(a, attrs[a]); }
		if (daddy) { daddy.insertBefore(sonny, bigBrother); }
		return sonny;
	}


	function addTextNode (daddy, text) {
		let sonny = document.createTextNode(text);
		if (daddy) { daddy.appendChild(sonny); }
		return sonny;
	}


	function makeRange (sn, so, fn, fo) {
		let range = document.createRange();
		range.setStart(sn, so);
		range.setEnd(fn, fo);
		return range;
	}



	describe('Fuzzy Anchoring Tests', () => {

		it('Single paragraph', () => {
			let div = addElement(testBody, 'div', {'Id': 'ThisIdIsTheBest'});
			let p = addElement(div, 'p', {});
			let t1 = addTextNode(p, 'This is some somewhat but not particularly long text for readers with short attention spans.');

			let range = makeRange(t1, 13, t1, 47);
			let rangeDescription = createRangeDescriptionFromRange(range, document).description;

			let start = rangeDescription.getStart();

			expect(start.getContexts()[0].contextOffset).toEqual(84);

			t1.data = 'This is some somewhat but not particularly long text for readers with short attention spans. Here are some extra words.';

			let walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			walker.currentNode = t1;
			let pointer = rangeDescription.getStart();

			expect(getCurrentNodeMatches(pointer, walker)[0].confidence).toBeCloseTo(0.458);
		});


		it('Multiple paragraphs with in-between additions', () => {
			let div = addElement(testBody, 'div', {'Id': 'ThisIdIsTheBest'});
			let p1 = addElement(div, 'p', {});
			let t1 = addTextNode(p1, 'This is some somewhat but not particularly long text for readers with short attention spans.');
			let p2 = addElement(div, 'p', {});
			let t2 = addTextNode(p2, 'This is some more text containing many,  many uninteresting words.');

			let range = makeRange(t1, 13, t2, 22);
			let rangeDescription = createRangeDescriptionFromRange(range, document).description;

			let start = rangeDescription.getStart();
			let startWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			startWalker.currentNode = t1;

			let end = rangeDescription.getEnd();
			let endWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			endWalker.currentNode = t2;

			//Insert image element in between
			/*let img = */insertElement(div, p2, 'img', {});

			expect(getCurrentNodeMatches(start, startWalker)[0].confidence).toEqual(1);
			expect(getCurrentNodeMatches(end, endWalker)[0].confidence).toEqual(1);

			//Insert span containing text in between
			let span = insertElement(div, p2, 'span', {});
			/*let t15 = */addTextNode(span, 'Here are some extra words in a span');

			expect(getCurrentNodeMatches(start, startWalker)[0].confidence).toEqual(1);
			expect(getCurrentNodeMatches(end, endWalker)[0].confidence).toEqual(1);
		});


		it('Multiple paragraphs with empty paragraphs added outside the range', () => {
			let div = addElement(testBody, 'div', {'Id': 'ThisIdIsTheBest'});
			let p1 = addElement(div, 'p', {});
			let t1 = addTextNode(p1, 'This is some somewhat but not particularly long text for readers with short attention spans.');
			let p2 = addElement(div, 'p', {});
			let t2 = addTextNode(p2, 'This is some more text containing many,  many uninteresting words.');

			let range = makeRange(t1, 13, t2, 22);
			let rangeDescription = createRangeDescriptionFromRange(range, document).description;

			let start = rangeDescription.getStart();
			let startWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			startWalker.currentNode = t1;

			let end = rangeDescription.getEnd();
			let endWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			endWalker.currentNode = t2;

			//Insert empty paragraphs before and after
			let p0 = insertElement(div, p1, 'p', {});
			let t0 = addTextNode(p0, '');
			let p3 = addElement(div, 'p', {});
			let t3 = addTextNode(p3, '');

			let preStartWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			preStartWalker.currentNode = t0;

			let afterEndWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			afterEndWalker.currentNode = t3;

			expect(getCurrentNodeMatches(start, startWalker)[0].confidence).toBeCloseTo(0.666);
			expect(getCurrentNodeMatches(start, preStartWalker).length).toEqual(0);
			expect(getCurrentNodeMatches(end, endWalker)[0].confidence).toBeCloseTo(0.666);
			expect(getCurrentNodeMatches(end, afterEndWalker).length).toEqual(0);
		});


		it('Multiple paragraphs with fals-matching paragraphs added outside the range', () => {
			let div = addElement(testBody, 'div', {'Id': 'ThisIdIsTheBest'});
			let p1 = addElement(div, 'p', {});
			let t1 = addTextNode(p1, 'This is some somewhat but not particularly long text for readers with short attention spans.');
			let p2 = addElement(div, 'p', {});
			let t2 = addTextNode(p2, 'This is some more text containing many,  many uninteresting words.');


			let range = makeRange(t1, 13, t2, 22);
			let rangeDescription = createRangeDescriptionFromRange(range, document).description;

			let start = rangeDescription.getStart();
			let startWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			startWalker.currentNode = t1;

			let end = rangeDescription.getEnd();
			let endWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			endWalker.currentNode = t2;

			//Insert empty paragraphs before and after
			let p0 = insertElement(div, p1, 'p', {});
			let t0 = addTextNode(p0, 'This is some somewhat misleading (to the anchoring system) introductory text');
			let p3 = addElement(div, 'p', {});
			let t3 = addTextNode(p3, 'And more text containing things normal text containing which is quite hard to find');

			let preStartWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			preStartWalker.currentNode = t0;

			let afterEndWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
			afterEndWalker.currentNode = t3;

			//Make those paragraphs contain false matches
			expect(getCurrentNodeMatches(start, preStartWalker).length).toEqual(1);
			expect(getCurrentNodeMatches(start, preStartWalker)[0].confidence).toBeCloseTo(0.535);
			expect(getCurrentNodeMatches(end, afterEndWalker).length).toEqual(2);
			expect(getCurrentNodeMatches(end, afterEndWalker)[0].confidence).toBeCloseTo(0.679);

			// console.log(getCurrentNodeMatches(end, afterEndWalker));

			expect(getCurrentNodeMatches(end, afterEndWalker)[1].confidence).toBeCloseTo(0.476);

			let bkStart = locateRangeEdgeForAnchor(start, div, null);
			let bkEnd = locateRangeEdgeForAnchor(end, div, null);

			expect(bkStart.confidence).toBeCloseTo(0.666);
			expect(bkStart.node.data).toEqual(t1.data);

			//Currently breaks on this case
			expect(bkEnd.confidence).toBeCloseTo(0.679);
			expect(bkEnd.node.data).toEqual(t3.data);
		});
	});


	describe('Roundtrip Tests', () => {
		it('Can do roundtrips with modifications all within a textnode', () => {
			let div = addElement(testBody, 'div', {'Id': 'ThisIdIsTheBest'});
			let span = addElement(div, 'span', {'Id': '12312312'});
			let p = addElement(span, 'p', {});
			let t1 = addTextNode(p, 'This is some somewhat but not particularly long text for readers with short attention spans.');
			let p2 = addElement(span, 'p', {});
			/*let t2 = */addTextNode(p2, 'This is some more text containing many uninteresting words.');

			let range = makeRange(t1, 13, t1, 47);
			let result = createRangeDescriptionFromRange(range, document).description;

			let bk = toDomRange(result, document, document.body);

			expect('' + bk).toEqual('somewhat but not particularly long');

			t1.data = 'This is some somewhat but not particularly long text for readers with short attention spans. Here are some extra words.';
			bk = toDomRange(result, document, document.body);

			expect('' + bk).toEqual('somewhat but not particularly long');
		});
	});
});
