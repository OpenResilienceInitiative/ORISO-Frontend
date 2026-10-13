import { useVisualViewport } from '../hooks/useVisualViewport';

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
 * The measurement itself is `useVisualViewport`, which the maximised composer
 * already uses for the same reason (#1248): what the layout viewport has and
 * the visual one does not, minus whatever is merely scrolled out of sight
 * above it. All this adds is the judgement of what counts as a keyboard, which
 * a bar that has to *move* needs and a panel that only sizes itself does not.
 */
export const useKeyboardInset = (): number => {
	const viewport = useVisualViewport();
	const covered = viewport?.bottomInset ?? 0;

	return covered > KEYBOARD_MIN_PX ? covered : 0;
};
