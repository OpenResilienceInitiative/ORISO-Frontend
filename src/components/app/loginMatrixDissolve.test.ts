// @vitest-environment oriso-jsdom

import { afterEach, expect, it, vi } from 'vite-plus/test';
import { LOGIN_MATRIX_TIMING, startLoginMatrix } from './loginMatrixDissolve';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	document.body.replaceChildren();
});

/** jsdom has no layout; every element counts as rendered. */
const render = () =>
	vi
		.spyOn(Element.prototype, 'getClientRects')
		.mockReturnValue([{}] as unknown as DOMRectList);

const at = (glyph: Element) =>
	Number((glyph as HTMLElement).style.getPropertyValue('--at'));

it('re-encodes the real text in place, button first, and restores it exactly', () => {
	vi.useFakeTimers();
	render();
	let nextFrame: FrameRequestCallback | undefined;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		nextFrame = callback;
		return 1;
	});
	const form = document.createElement('form');
	form.innerHTML = `
		<h2><span>Anmelden</span></h2>
		<label for="pass">Passwort</label>
		<div><input id="pass" type="password"></div>
		<p>Code <b>prüfen</b></p>
		<legend><span>Passwort</span></legend>
		<span class="notranslate">​</span>
		<button type="submit"><span>Anmelden</span></button>
	`;
	document.body.append(form);
	const before = form.innerHTML;
	const input = form.querySelector('input')!;
	// The animation never reads or writes a credential.
	const forbidden = () => {
		throw new Error('Animation accessed a credential');
	};
	Object.defineProperty(input, 'value', { get: forbidden, set: forbidden });
	const button = form.querySelector('button')!;
	const heading = form.querySelector('h2 span')!;
	const headingText = heading.firstChild;

	for (let attempt = 0; attempt < 2; attempt++) {
		const scene = startLoginMatrix(form);
		// The submit frame turns only the button, from the very start.
		expect(button.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		expect(form.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		expect(Math.min(...[...button.children[0].children].map(at))).toBe(0);
		nextFrame!(performance.now());

		// Every readable line follows, in reading order, after the button.
		const lines = ['h2', 'label', 'p'].map((selector) =>
			Math.min(
				...[
					...form.querySelectorAll(`${selector} .loginMatrixGlyph`)
				].map(at)
			)
		);
		expect(lines[0]).toBeGreaterThanOrEqual(LOGIN_MATRIX_TIMING.lead - 1);
		expect(lines).toEqual([...lines].sort((a, b) => a - b));
		// Hidden copies, zero-width padding and inputs are left alone.
		expect(form.querySelector('legend .loginMatrixGlyph')).toBeNull();
		expect(form.querySelector('.notranslate .loginMatrixGlyph')).toBeNull();
		// Letters stay in the DOM: the accessible text does not change.
		expect(button.textContent).toBe('Anmelden');
		expect(heading.firstChild).toBe(headingText);
		const digits = [...form.querySelectorAll<HTMLElement>('[data-digit]')];
		expect(
			digits.every(({ dataset }) => /^[01]$/.test(dataset.digit!))
		).toBe(true);

		// Long waits: one digit at a time flips, then pause stops it.
		const settled = digits.map(({ dataset }) => dataset.digit).join('');
		vi.advanceTimersByTime(scene.duration);
		const flipped = digits.map(({ dataset }) => dataset.digit).join('');
		expect(flipped).not.toBe(settled);
		scene.pause();
		vi.advanceTimersByTime(10_000);
		expect(digits.map(({ dataset }) => dataset.digit).join('')).toBe(
			flipped
		);

		scene.dispose();
		expect(form.innerHTML).toBe(before);
		expect(heading.firstChild).toBe(headingText);
	}
});
