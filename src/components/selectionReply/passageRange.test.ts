// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

import { jumpToPassage } from './passageRange';

const PASSAGE = 'Termin am Amtsgericht';

let scrolled: Element[] = [];

const timeline = (html: string) => {
	const scope = document.createElement('div');
	scope.innerHTML = `<div data-message-id="$1"><div class="messageItem__message">${html}</div></div>`;
	document.body.appendChild(scope);
	return scope;
};

beforeEach(() => {
	scrolled = [];
	Element.prototype.scrollIntoView = function (this: Element) {
		scrolled.push(this);
	};
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
	it('ends on the passage of a long message, not on its bubble', () => {
		const scope = timeline(
			`<p>Anfang</p><p data-testid="passage">${PASSAGE}</p>`
		);
		jumpToPassage(scope, '$1', PASSAGE)();
		expect(scrolled.at(-1)).toBe(
			scope.querySelector('[data-testid="passage"]')
		);
	});

	it('scrolls to the passage once a shortened message is opened', () => {
		const scope = timeline(
			'<p>Anfang</p><button class="messageItem__expandBtn" aria-expanded="false">mehr</button>'
		);
		const bubble = scope.querySelector('.messageItem__message')!;
		scope.querySelector('button')!.addEventListener('click', () => {
			bubble.insertAdjacentHTML(
				'beforeend',
				`<p data-testid="passage">${PASSAGE}</p>`
			);
		});
		jumpToPassage(scope, '$1', PASSAGE)();
		expect(scrolled.at(-1)).toBe(
			scope.querySelector('[data-testid="passage"]')
		);
	});
});
