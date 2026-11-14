// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { findPassageRange, jumpToPassage } from './passageRange';

const PASSAGE = 'Termin am Amtsgericht';

let scrolled: Element[] = [];
let scrolledBy: ScrollToOptions[] = [];

const timeline = (html: string) => {
	const scope = document.createElement('div');
	scope.innerHTML = `<div data-message-id="$1"><div class="messageItem__message">${html}</div></div>`;
	document.body.appendChild(scope);
	return scope;
};

beforeEach(() => {
	scrolled = [];
	scrolledBy = [];
	Element.prototype.scrollIntoView = function (this: Element) {
		scrolled.push(this);
	};
	vi.spyOn(window, 'scrollBy').mockImplementation(((
		options: ScrollToOptions
	) => {
		scrolledBy.push(options);
	}) as typeof window.scrollBy);
	// The passage sits 900px down a 600px window.
	vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue({
		top: 900,
		height: 20
	} as DOMRect);
	vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((run) => {
		run(0);
		return 1;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('jumpToPassage', () => {
	it('centres the passage of a long message by its own position', () => {
		const scope = timeline(`<p>Anfang</p><p>${PASSAGE}</p>`);
		jumpToPassage(scope, '$1', PASSAGE)();
		expect(scrolled).toHaveLength(0);
		expect(scrolledBy.at(-1)).toMatchObject({ top: 610 });
	});

	it('centres the passage once a shortened message is opened', () => {
		const scope = timeline(
			'<p>Anfang</p><button class="messageItem__expandBtn" aria-expanded="false">mehr</button>'
		);
		const bubble = scope.querySelector('.messageItem__message')!;
		scope.querySelector('button')!.addEventListener('click', () => {
			bubble.insertAdjacentHTML('beforeend', `<p>${PASSAGE}</p>`);
		});
		jumpToPassage(scope, '$1', PASSAGE)();
		expect(scrolled).toEqual([bubble]);
		expect(scrolledBy.at(-1)).toMatchObject({ top: 610 });
	});
});

describe('findPassageRange', () => {
	it('finds the occurrence that was marked when the text repeats', () => {
		const root = document.createElement('div');
		root.innerHTML = '<p>Anna ruft an. Später ruft Anna nochmal an.</p>';
		const text = root.querySelector('p')!.firstChild!;
		const second = findPassageRange(root, 'Anna', 26)!;
		expect(second.startContainer).toBe(text);
		expect(second.startOffset).toBe(26);
		expect(findPassageRange(root, 'Anna')!.startOffset).toBe(0);
	});
});
