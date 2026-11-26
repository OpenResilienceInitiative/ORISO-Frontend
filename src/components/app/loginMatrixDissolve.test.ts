// @vitest-environment oriso-jsdom

import { afterEach, expect, it, vi } from 'vite-plus/test';
import { LOGIN_MATRIX_TIMING, startLoginMatrix } from './loginMatrixDissolve';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

/** jsdom has no layout; every element counts as rendered. */
const render = () =>
	vi
		.spyOn(Element.prototype, 'getClientRects')
		.mockReturnValue([{}] as unknown as DOMRectList);

const at = (glyph: Element) =>
	Number((glyph as HTMLElement).style.getPropertyValue('--at'));

it('re-encodes the real text and the typed values in place, keeps going in long waits, and restores everything exactly', () => {
	render();
	let nextFrame: FrameRequestCallback | undefined;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		nextFrame = callback;
		return 1;
	});
	vi.stubGlobal('cancelAnimationFrame', () => {
		nextFrame = undefined;
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
	// The animation may count the typed characters, but never writes them
	// anywhere and never changes the value.
	Object.defineProperty(input, 'value', {
		get: () => 'secret-name',
		set: () => {
			throw new Error('Animation wrote a credential');
		}
	});
	const button = form.querySelector('button')!;
	const heading = form.querySelector('h2 span')!;
	const headingText = heading.firstChild;

	let t0 = 0;
	const frame = (ms: number) => nextFrame?.(t0 + ms);
	for (let attempt = 0; attempt < 2; attempt++) {
		t0 = performance.now();
		const scene = startLoginMatrix(form);
		// The submit frame turns only the button, at random places within it.
		expect(button.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		expect(form.querySelectorAll('.loginMatrixGlyph')).toHaveLength(8);
		const turns = [...button.querySelectorAll('.loginMatrixGlyph')].map(at);
		expect(Math.min(...turns)).toBeGreaterThanOrEqual(-50);
		expect(Math.max(...turns)).toBeLessThanOrEqual(
			LOGIN_MATRIX_TIMING.button
		);

		// Frame 1: what is being sent turns first, one sign per character.
		frame(16);
		const row = form.querySelector('.loginMatrixValue')!;
		expect(row.getAttribute('aria-hidden')).toBe('true');
		expect(row.children).toHaveLength('secret-name'.length);
		expect(form.innerHTML).not.toContain('secret');

		// Frame 2: every readable line follows; the heading first.
		frame(32);
		const lines = ['h2', 'label', 'p'].map((selector) =>
			Math.min(
				...[
					...form.querySelectorAll(`${selector} .loginMatrixGlyph`)
				].map(at)
			)
		);
		expect(lines[0]).toBeGreaterThanOrEqual(
			LOGIN_MATRIX_TIMING.heading - 50
		);
		expect(Math.min(lines[1], lines[2])).toBeGreaterThanOrEqual(
			LOGIN_MATRIX_TIMING.lead - 50
		);

		// Frame 3: the field's icon and outline are redrawn as signs.
		frame(48);
		const field = form.querySelector<HTMLElement>(
			'.MuiOutlinedInput-root'
		)!;
		expect(field.dataset.matrixField).toBe('');
		expect(
			field.querySelector<HTMLElement>(
				'.MuiInputAdornment-positionStart'
			)!.dataset.grid
		).toMatch(/^.{3}\n.{3}\n.{3}$/u);
		const edge = field.querySelector('.loginMatrixEdge')!;
		expect(edge.getAttribute('aria-hidden')).toBe('true');
		expect(edge.textContent!.length).toBeGreaterThan(3);

		// Frame 4: the curtain of signs over the whole light area, behind
		// everything, hidden from assistive technology.
		frame(64);
		const rain = form.firstElementChild as HTMLElement;
		expect(rain.className).toBe('loginMatrixRain');
		expect(rain.getAttribute('aria-hidden')).toBe('true');
		expect(rain.style.width).toMatch(/px$/);
		expect(rain.style.getPropertyValue('--fall')).toMatch(/px$/);

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
		const signs = [...form.querySelectorAll<HTMLElement>('[data-digit]')];
		expect(signs.every(({ dataset }) => dataset.digit!.length === 1)).toBe(
			true
		);

		// Long waits: waves keep rattling through the settled signs, for as
		// long as the answer takes; pause stops them.
		const read = () => signs.map(({ dataset }) => dataset.digit).join('');
		let previous = read();
		for (const wait of [500, 5000, 20000]) {
			frame(scene.duration + wait);
			expect(read()).not.toBe(previous);
			previous = read();
		}
		scene.pause();
		frame(scene.duration + 30000);
		expect(read()).toBe(previous);

		scene.dispose();
		expect(form.innerHTML).toBe(before);
		expect(heading.firstChild).toBe(headingText);
	}
});
