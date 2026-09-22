import { useEffect, useState } from 'react';

/**
 * Anything smaller than this is the browser's own chrome — the collapsing URL
 * bar on a phone is 50–100 px — not a keyboard. Software keyboards are well
 * above it on every phone in use, so the threshold separates the two without
 * having to ask which browser this is.
 */
const KEYBOARD_MIN_PX = 120;

/**
 * How many CSS pixels of the layout viewport the on-screen keyboard covers.
 * `0` whenever no keyboard is up — and on every browser that cannot tell,
 * which is the behaviour those browsers have today.
 *
 * **Why this is needed.** A `position: fixed; bottom: 0` bar is placed against
 * the *layout* viewport. Opening the software keyboard does not shrink that
 * viewport: iOS Safari never resizes it, and Chrome for Android only does when
 * the page asks for it (`interactive-widget=resizes-content`, which this app's
 * viewport meta does not set). The field being typed into is pushed up into
 * view by the browser, the bar is not — it stays under the keyboard. On the
 * postcode step that is the whole footer: the number pad covers it, so at the
 * moment the fifth digit lands there is nothing on screen saying what comes
 * next, which is exactly when a person needs to be told (Frank, 2026-09-22:
 * "dann weiß ich nämlich, was ich als nächstes machen muss").
 *
 * `window.visualViewport` reports the part of the page that is actually
 * visible. What the layout viewport has and the visual one does not — minus
 * whatever is merely scrolled out of sight above it — is the keyboard.
 */
export const useKeyboardInset = (): number => {
	const [inset, setInset] = useState(0);

	useEffect(() => {
		const viewport =
			typeof window !== 'undefined' ? window.visualViewport : undefined;

		if (!viewport) {
			return undefined;
		}

		let frame: number | null = null;

		const read = () => {
			frame = null;
			const covered =
				window.innerHeight - viewport.height - viewport.offsetTop;
			setInset(covered > KEYBOARD_MIN_PX ? Math.round(covered) : 0);
		};

		/* The keyboard animates in, so both events fire many times per second
		   while it does. Coalescing them into one read per frame keeps the bar
		   travelling with the keyboard instead of ahead of a layout queue. */
		const schedule = () => {
			if (frame !== null) {
				return;
			}
			frame =
				typeof window.requestAnimationFrame === 'function'
					? window.requestAnimationFrame(read)
					: (window.setTimeout(read, 16) as unknown as number);
		};

		read();
		viewport.addEventListener('resize', schedule);
		viewport.addEventListener('scroll', schedule);

		return () => {
			if (frame !== null) {
				if (typeof window.cancelAnimationFrame === 'function') {
					window.cancelAnimationFrame(frame);
				} else {
					window.clearTimeout(frame);
				}
			}
			viewport.removeEventListener('resize', schedule);
			viewport.removeEventListener('scroll', schedule);
		};
	}, []);

	return inset;
};
