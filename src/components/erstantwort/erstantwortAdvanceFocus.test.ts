// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceFocusTo, prefersReducedMotion } from './erstantwortAdvanceFocus';

/**
 * The four parts of Frank's "smooth und angenehm zu nächsten stelle" rule,
 * pinned separately — each of them can regress on its own, and three of the
 * four regress **silently**: a missing `preventScroll` still scrolls, a
 * forgotten reduced-motion check still moves, and a missing focus call still
 * looks right on a screenshot.
 */

const setReducedMotion = (reduce: boolean) => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		configurable: true,
		value: (query: string) => ({
			matches: reduce && query.includes('prefers-reduced-motion'),
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		})
	});
};

const mountTarget = () => {
	const element = document.createElement('div');
	element.tabIndex = -1;
	document.body.appendChild(element);
	const scrollIntoView = vi.fn();
	element.scrollIntoView = scrollIntoView;
	return { element, scrollIntoView };
};

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('advanceFocusTo', () => {
	it('scrolls smoothly to the middle of the viewport', () => {
		setReducedMotion(false);
		const { scrollIntoView } = mountTarget();

		expect(advanceFocusTo(document.body.firstElementChild as HTMLElement)).toBe(
			true
		);
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'center'
		});
	});

	it('jumps instead of animating when reduced motion is requested', () => {
		setReducedMotion(true);
		const { element, scrollIntoView } = mountTarget();

		advanceFocusTo(element);

		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: 'auto',
			block: 'center'
		});
	});

	it('moves the focus to the target', () => {
		setReducedMotion(false);
		const { element } = mountTarget();

		advanceFocusTo(element);

		expect(document.activeElement).toBe(element);
	});

	/**
	 * The regression that makes the smooth scroll look unimplemented: a plain
	 * `focus()` scrolls instantly and cancels the animation started one line
	 * earlier.
	 */
	it('focuses without scrolling, so it does not cancel its own animation', () => {
		setReducedMotion(false);
		const { element } = mountTarget();
		const focus = vi.spyOn(element, 'focus');

		advanceFocusTo(element);

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	it('reports that nothing happened when there is no next step', () => {
		setReducedMotion(false);
		expect(advanceFocusTo(null)).toBe(false);
	});
});

describe('prefersReducedMotion', () => {
	it('reads the setting at call time rather than at module load', () => {
		setReducedMotion(false);
		expect(prefersReducedMotion()).toBe(false);
		setReducedMotion(true);
		expect(prefersReducedMotion()).toBe(true);
	});
});
