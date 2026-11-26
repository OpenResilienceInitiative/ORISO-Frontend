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
		<div class="MuiOutlinedInput-root"><span class="MuiInputAdornment-positionStart"><svg></svg></span><input id="pass" type="password"><fieldset><legend><span>Passwort</span></legend></fieldset></div>
		<p>Code <b>prüfen</b></p>
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
		// The submit frame turns only the button, at random places within it.
		expect(button.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		expect(form.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		const turns = [...button.querySelectorAll('.loginMatrixGlyph')].map(at);
		expect(Math.min(...turns)).toBeGreaterThanOrEqual(-1);
		expect(Math.max(...turns)).toBeLessThanOrEqual(
			LOGIN_MATRIX_TIMING.button
		);
		nextFrame!(performance.now());

		// Every readable line follows the button.
		const lines = ['h2', 'label', 'p'].map((selector) =>
			Math.min(
				...[
					...form.querySelectorAll(`${selector} .loginMatrixGlyph`)
				].map(at)
			)
		);
		// The heading turns right after the button, the other lines after it.
		expect(lines[0]).toBeGreaterThanOrEqual(
			LOGIN_MATRIX_TIMING.heading - 1
		);
		expect(Math.min(lines[1], lines[2])).toBeGreaterThanOrEqual(
			LOGIN_MATRIX_TIMING.lead - 1
		);
		// The field's outline is redrawn as digits on its own edge.
		const field = form.querySelector<HTMLElement>(
			'.MuiOutlinedInput-root'
		)!;
		expect(field.dataset.matrixField).toBe('');
		const edge = field.querySelector('.loginMatrixEdge')!;
		expect(edge.getAttribute('aria-hidden')).toBe('true');
		expect(edge.textContent).toMatch(/^[01]+$/);
		// Hidden copies, zero-width padding and inputs are left alone.
		expect(form.querySelector('legend .loginMatrixGlyph')).toBeNull();
		expect(form.querySelector('fieldset .loginMatrixGlyph')).toBeNull();
		expect(form.querySelector('.notranslate .loginMatrixGlyph')).toBeNull();
		// Each text becomes one inline box with its spaces, so a flex parent
		// still lays it out as one item.
		const code = form.querySelector('p')!.firstChild!.nextSibling!;
		expect(code.nodeName).toBe('SPAN');
		expect(code.textContent).toBe('Code ');
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
