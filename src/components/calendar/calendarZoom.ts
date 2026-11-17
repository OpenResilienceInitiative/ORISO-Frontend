/**
 * Zoom in the time grid (Frank's prototype v15, 14 Nov): − and + change the
 * height of half an hour in steps; pinching on a trackpad or with two
 * fingers zooms smoothly, and the time under the fingers stays where it
 * is. The time grid and "Nebeneinander" share one height.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';

/** Pixels per half hour, from far out to close in. */
export const ZOOM_STEPS = [18, 22, 30, 40, 56, 76, 96] as const;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Today's heights, where zooming starts: the time grid … */
export const GRID_SLOT_PX = 25;
/** … and "Nebeneinander" (48 px per hour). */
export const SPLIT_SLOT_PX = 24;

/** Within the bounds, to a tenth of a pixel. */
export const clampZoom = (px: number) =>
	Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, px)) * 10) / 10;

/** The next step in that direction, or the bound when none is left. */
export const zoomStep = (current: number, direction: 1 | -1) => {
	const next =
		direction > 0
			? ZOOM_STEPS.find((step) => step > current + 0.5)
			: [...ZOOM_STEPS].reverse().find((step) => step < current - 0.5);
	return next ?? (direction > 0 ? ZOOM_MAX : ZOOM_MIN);
};

/**
 * The scroll position that keeps the time `y` pixels below the top of the
 * scroller in place when half an hour goes from `from` to `to` pixels.
 * `bodyTop` is where the time starts inside the scrolled content.
 */
export const anchoredScrollTop = ({
	scrollTop,
	y,
	bodyTop = 0,
	from,
	to
}: {
	scrollTop: number;
	y: number;
	bodyTop?: number;
	from: number;
	to: number;
}) => Math.max(0, ((scrollTop + y - bodyTop) / from) * to + bodyTop - y);

/** The time body and the element that scrolls it vertically. */
const timeline = (root: HTMLElement) => {
	const body =
		root.querySelector<HTMLElement>('.calendarSplit__body') ??
		root.querySelector<HTMLElement>(
			'[data-testid="calendar-view"] [data-time]'
		);
	let scroller = body?.parentElement ?? null;
	while (scroller && scroller !== root.parentElement) {
		const { overflowY } = getComputedStyle(scroller);
		if (overflowY === 'auto' || overflowY === 'scroll') break;
		scroller = scroller.parentElement;
	}
	if (!body || !scroller || scroller === root.parentElement) return null;
	return { body, scroller };
};

/** The two-finger distance; sideways counts a quarter, as in the prototype. */
const span = (touches: TouchList) =>
	Math.abs(touches[0].clientY - touches[1].clientY) +
	Math.abs(touches[0].clientX - touches[1].clientX) * 0.25;

/**
 * Pinch zoom on `root`: wheel with Ctrl (trackpad pinch in Chrome, Edge and
 * Firefox), Safari's gesture events and two fingers on a touch screen.
 * Every change, the buttons' included, keeps the time under the pointer
 * (or the middle, for the buttons) in place.
 *
 * Returns `zoomTo(px, clientY?)` for the buttons.
 */
export const useCalendarZoom = (
	root: HTMLElement | null,
	{
		enabled,
		slotPx,
		onZoom
	}: { enabled: boolean; slotPx: number; onZoom: (px: number) => void }
) => {
	const rootRef = useRef(root);
	rootRef.current = root;
	const current = useRef(slotPx);
	current.current = slotPx;
	// The height on screen; a pinch can ask again before it is rendered.
	const rendered = useRef(slotPx);
	const zoom = useRef(onZoom);
	zoom.current = onZoom;
	// Where to put the scroll once the new height is rendered: taken
	// from the screen as it was before the first of these changes.
	const pending = useRef<{
		scroller: HTMLElement;
		y: number;
		bodyTop: number;
		scrollTop: number;
		from: number;
	} | null>(null);

	const zoomTo = useRef((px: number, clientY?: number) => {
		const next = clampZoom(px);
		if (next === current.current) return;
		const found =
			!pending.current && rootRef.current
				? timeline(rootRef.current)
				: null;
		if (found) {
			const { scroller, body } = found;
			const box = scroller.getBoundingClientRect();
			const y =
				clientY === undefined
					? scroller.clientHeight / 2
					: Math.max(
							0,
							Math.min(scroller.clientHeight, clientY - box.top)
						);
			pending.current = {
				scroller,
				y,
				scrollTop: scroller.scrollTop,
				bodyTop:
					body.getBoundingClientRect().top -
					box.top +
					scroller.scrollTop,
				from: rendered.current
			};
		}
		current.current = next;
		zoom.current(next);
	}).current;

	useLayoutEffect(() => {
		rendered.current = slotPx;
		const keep = pending.current;
		if (!keep) return undefined;
		pending.current = null;
		const top = anchoredScrollTop({ ...keep, to: slotPx });
		const { scroller } = keep;
		scroller.scrollTop = top;
		// FullCalendar puts its own remembered scroll back once it has
		// taken the new height (in the next frame); this comes after it.
		const frame = requestAnimationFrame(() => {
			scroller.scrollTop = top;
		});
		return () => cancelAnimationFrame(frame);
	}, [slotPx]);

	useEffect(() => {
		if (!root || !enabled) return undefined;
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			event.preventDefault();
			zoomTo(
				current.current * Math.exp(-event.deltaY * 0.01),
				event.clientY
			);
		};
		// Safari: scale is relative to where the gesture started.
		let gestureFrom: number | null = null;
		const onGestureStart = (event: Event) => {
			event.preventDefault();
			gestureFrom = current.current;
		};
		const onGestureChange = (event: Event) => {
			if (gestureFrom === null) return;
			event.preventDefault();
			const { scale, clientY } = event as Event & {
				scale: number;
				clientY: number;
			};
			zoomTo(gestureFrom * scale, clientY);
		};
		const onGestureEnd = () => {
			gestureFrom = null;
		};
		let pinch: { distance: number; from: number } | null = null;
		const onTouchStart = (event: TouchEvent) => {
			pinch =
				event.touches.length === 2
					? { distance: span(event.touches), from: current.current }
					: null;
		};
		const onTouchMove = (event: TouchEvent) => {
			if (!pinch || event.touches.length !== 2) return;
			event.preventDefault();
			zoomTo(
				pinch.from *
					(span(event.touches) / Math.max(1, pinch.distance)),
				(event.touches[0].clientY + event.touches[1].clientY) / 2
			);
		};
		const onTouchEnd = (event: TouchEvent) => {
			if (event.touches.length < 2) pinch = null;
		};
		root.addEventListener('wheel', onWheel, { passive: false });
		root.addEventListener('gesturestart', onGestureStart);
		root.addEventListener('gesturechange', onGestureChange);
		root.addEventListener('gestureend', onGestureEnd);
		root.addEventListener('touchstart', onTouchStart, { passive: true });
		root.addEventListener('touchmove', onTouchMove, { passive: false });
		root.addEventListener('touchend', onTouchEnd);
		root.addEventListener('touchcancel', onTouchEnd);
		return () => {
			root.removeEventListener('wheel', onWheel);
			root.removeEventListener('gesturestart', onGestureStart);
			root.removeEventListener('gesturechange', onGestureChange);
			root.removeEventListener('gestureend', onGestureEnd);
			root.removeEventListener('touchstart', onTouchStart);
			root.removeEventListener('touchmove', onTouchMove);
			root.removeEventListener('touchend', onTouchEnd);
			root.removeEventListener('touchcancel', onTouchEnd);
		};
	}, [root, enabled, zoomTo]);

	return zoomTo;
};
