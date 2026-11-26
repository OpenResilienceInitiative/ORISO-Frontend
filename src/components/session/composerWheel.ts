import {
	canScrollAlong,
	wheelDeltaPx
} from '../messageSubmitInterface/inputField/scrollableBar';

/**
 * #2513: the composer dock is absolutely positioned over the bottom of the
 * timeline (T41). It is not inside the timeline, so a wheel or touchpad
 * scroll over it never reaches the timeline: the browser chains it to the
 * page, which does not scroll. On a laptop the dock covers about half of the
 * visible chat, and scrolling up "does nothing" whenever the pointer rests
 * there — which, after clicking into the composer to write, it usually does.
 *
 * A scroll over the dock goes to the timeline, unless something in the dock
 * (a long draft, an open menu) can scroll that way itself.
 */

const DOCK_SELECTOR = '.messageSubmit__wrapper';

// The unit conversion and the can-scroll rule are shared with the composer
// toolbar's sideways scroll (`useScrollableBar`). The listener stays here:
// that one turns a wheel sideways inside the toolbar, this one hands a wheel
// over the whole dock to the timeline behind it.
const canScrollY = (element: Element, delta: number): boolean => {
	const { overflowY } = getComputedStyle(element);
	if (overflowY !== 'auto' && overflowY !== 'scroll') {
		return false;
	}
	return canScrollAlong(
		element.scrollTop,
		element.scrollHeight,
		element.clientHeight,
		delta
	);
};

/** Something between the pointer and `boundary` scrolls this way on its own. */
export const scrollsItself = (
	target: Element,
	boundary: Element,
	delta: number
): boolean => {
	for (
		let element: Element | null = target;
		element && element !== boundary;
		element = element.parentElement
	) {
		if (canScrollY(element, delta)) {
			return true;
		}
	}
	return false;
};

/**
 * Wheel listener for the pane that holds the timeline and the composer dock.
 * Anything not over the dock is left to the browser.
 *
 * `loadEarlier` is the timeline's own start-of-history loader. The timeline
 * calls it from its `onWheel`, which a wheel over the dock never reaches, so
 * an upward wheel here calls it too. The loader keeps its own threshold and
 * in-flight checks.
 */
export const forwardComposerWheel = (
	event: WheelEvent,
	pane: Element,
	timeline: HTMLElement | null,
	loadEarlier?: () => void
): void => {
	const target = event.target instanceof Element ? event.target : null;
	if (!timeline || !target?.closest(DOCK_SELECTOR)) {
		return;
	}
	// Already used (the toolbar scrolls sideways), or a touchpad pinch-zoom.
	if (event.defaultPrevented || event.ctrlKey || event.deltaY === 0) {
		return;
	}
	const delta = wheelDeltaPx(
		event.deltaY,
		event.deltaMode,
		timeline.clientHeight
	);
	if (scrollsItself(target, pane, delta)) {
		return;
	}
	timeline.scrollTop += delta;
	event.preventDefault();
	if (delta < 0) {
		loadEarlier?.();
	}
};
