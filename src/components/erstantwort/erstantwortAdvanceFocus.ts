import { useCallback, useEffect, useRef } from 'react';

/**
 * **Gentle forward motion — Frank's requirement of 2026-09-07 (evening), not a
 * nicety.**
 *
 * On the decision to show the *outcome* instead of the buttons once a message
 * is answered, he said it is fine *"so lange wir immer mittels anchor tags
 * smooth und angenehm zu nächsten stelle weitergeleitet werden. wo wir was
 * machen müssen. das ist wichtig das dies ordentlich funktioniert."*
 *
 * So this is the contract, and it has four parts, all of which are easy to get
 * three-quarters right:
 *
 * 1. **Scroll smoothly to the next place where something has to be done** —
 *    `block: 'center'`, not `'start'`: a chat message scrolled to the very top
 *    of the viewport loses the message that caused it, and the person cannot
 *    tell what just happened.
 * 2. **Respect `prefers-reduced-motion`.** A smooth scroll is vestibular
 *    motion. Reduce means jump, not "smooth but shorter".
 * 3. **Move the focus there**, so the keyboard and the screen reader go where
 *    the eye went. The target carries `tabIndex={-1}` — programmatically
 *    focusable, never a tab stop of its own.
 * 4. **`focus({ preventScroll: true })`.** This is the part that silently
 *    breaks the other three: a plain `focus()` scrolls the element into view
 *    *instantly*, which cancels the smooth scroll that started one line
 *    earlier. The result is a hard jump on every browser, and it looks like the
 *    smooth scroll was never implemented.
 *
 * STORYBOOK ONLY so far — the Erstantwort stories are the only consumer, and
 * nothing in the app chains messages yet.
 */

/**
 * Read at call time, not at module load: Storybook, tests and the OS can all
 * flip the setting while the page is open, and a value captured once would
 * outlive the change.
 */
export const prefersReducedMotion = (): boolean =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll `element` into the middle of the viewport and put the focus on it.
 *
 * Returns whether anything happened, so a caller can tell "there was no next
 * step" apart from "the next step was not mounted yet" — the second is a bug,
 * the first is the end of the chain.
 */
export const advanceFocusTo = (element: HTMLElement | null): boolean => {
	if (!element) return false;

	element.scrollIntoView({
		behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		block: 'center'
	});
	/* See point 4 above. Without `preventScroll` this line undoes the one
	   above it. */
	element.focus({ preventScroll: true });
	return true;
};

export interface AdvanceFocusApi {
	/** `ref` callback for a step container, keyed by the step's id. */
	register: (id: string) => (node: HTMLElement | null) => void;
}

/**
 * Follows `openStepId`: whenever it *changes* to a non-null id, the registered
 * element for that id is scrolled to and focused.
 *
 * **Not on the first render.** The chain's first open step is already on screen
 * when the message arrives; scrolling to it would yank the page the moment the
 * conversation opens, and focusing it would steal focus from the composer.
 */
export const useAdvanceFocus = (openStepId: string | null): AdvanceFocusApi => {
	const nodes = useRef(new Map<string, HTMLElement>());
	const lastHandled = useRef<string | null>(openStepId);

	const register = useCallback(
		(id: string) => (node: HTMLElement | null) => {
			if (node) nodes.current.set(id, node);
			else nodes.current.delete(id);
		},
		[]
	);

	useEffect(() => {
		if (openStepId === lastHandled.current) return;
		lastHandled.current = openStepId;
		if (!openStepId) return;
		advanceFocusTo(nodes.current.get(openStepId) ?? null);
	}, [openStepId]);

	return { register };
};
