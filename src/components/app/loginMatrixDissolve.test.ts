// @vitest-environment oriso-jsdom

import { afterEach, expect, it, vi } from 'vite-plus/test';
import { startLoginMatrix } from './loginMatrixDissolve';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	document.body.replaceChildren();
});

it('animates only display slots and restores the actual form on error or retry', () => {
	vi.useFakeTimers();
	const canvas = document.createElement('canvas');
	vi.spyOn(canvas, 'getContext').mockReturnValue(null);
	const form = document.createElement('form');
	form.innerHTML = `
		<button><span data-cipher-at="65">Anmelden</span></button>
		<label for="pass">Passwort</label>
		<div><input id="pass" type="password" data-cipher-input="890" data-cipher-length="8"></div>
		<div><input name="otp" data-cipher-input="925" data-cipher-length="6"></div>
	`;
	document.body.append(form);
	const label = form.querySelector('label')!;
	const original = label.firstChild;
	const button = form.querySelector('button')!;
	const inputs = form.querySelectorAll('input');
	// Neither a getter nor a setter may be touched, including on dispose.
	const forbidden = () => {
		throw new Error('Animation accessed a credential');
	};
	for (const input of inputs)
		Object.defineProperty(input, 'value', {
			get: forbidden,
			set: forbidden
		});
	let draw: FrameRequestCallback | undefined;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		draw = callback;
		return 1;
	});
	for (let attempt = 0; attempt < 2; attempt++) {
		const started = performance.now();
		const scene = startLoginMatrix(canvas, form);
		draw!(started + 460);
		expect(button.textContent).toMatch(/[01]/);
		expect(button.textContent).toMatch(/[A-Za-z]/);
		expect(form.querySelector('[data-cipher-masked]')).toBeNull();
		draw!(started + 2100);
		expect(button.textContent).toMatch(/^[01]+$/);
		expect(label.textContent).toMatch(/^[01]+$/);
		const masks = [...form.querySelectorAll('.loginMatrixFieldMask')];
		expect(masks.map((mask) => mask.textContent)).toEqual([
			expect.stringMatching(/^[01]{8}$/),
			expect.stringMatching(/^[01]{6}$/)
		]);
		expect(
			masks.every((mask) => mask.getAttribute('aria-hidden') === 'true')
		).toBe(true);
		const settled = form.textContent;
		vi.advanceTimersByTime(1800);
		expect(form.textContent).not.toBe(settled);
		scene.pause();
		const paused = form.textContent;
		vi.advanceTimersByTime(6000);
		expect(form.textContent).toBe(paused);
		scene.dispose();
		expect(
			form.querySelector('.loginMatrixFieldMask, [data-cipher-masked]')
		).toBeNull();
		expect(label.firstChild).toBe(original);
		expect(button.textContent).toBe('Anmelden');
	}
});
