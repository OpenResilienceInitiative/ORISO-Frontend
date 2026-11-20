/**
 * Paging the calendar without the toolbar (Frank's prototype, 2026-11-14):
 *
 * - a horizontal trackpad swipe pages like the arrows,
 * - near the left or right edge the shared edge arrow fades in (the same
 *   strip and round button as `HoverScrollArrows`),
 * - while an entry is dragged, resting at an edge pages after
 *   {@link DWELL_MS} and keeps paging every {@link REPEAT_MS}.
 *
 * `enabled = false` (split view with more people than fit) leaves the
 * swipe to the content, which then scrolls the people sideways.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	EdgeArrow,
	type ScrollDirection,
	type Side
} from '../hoverScrollArrows/HoverScrollArrows';

/** Resting at an edge while dragging pages after this long … */
export const DWELL_MS = 700;
/** … and then again after every further interval. */
export const REPEAT_MS = 900;
/** How far into the grid an edge reaches. */
const EDGE_PX = 72;
/** Horizontal wheel distance that counts as one swipe. */
const SWIPE_PX = 60;
/**
 * One swipe pages once, however long the trackpad keeps scrolling: the
 * swipe ends only after this long without a horizontal wheel event.
 */
export const SWIPE_IDLE_MS = 200;

export interface CalendarPagerProps {
	'onPage': (direction: ScrollDirection) => void;
	/** Swipe and arrows page; off when the content scrolls sideways itself. */
	'enabled'?: boolean;
	/** An entry is being dragged: dwell at an edge pages. */
	'dragging'?: boolean;
	'children': React.ReactNode;
	'data-cy'?: string;
}

export const CalendarPager = ({
	onPage,
	enabled = true,
	dragging = false,
	children,
	'data-cy': dataCy = 'calendar-pager'
}: CalendarPagerProps) => {
	const { t } = useTranslation();
	const ref = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState<Side | null>(null);
	const page = useRef(onPage);
	page.current = onPage;

	// Trackpad swipe: sum the horizontal wheel delta, page once per swipe.
	useEffect(() => {
		const el = ref.current;
		if (!el || !enabled) return undefined;
		let sum = 0;
		// Set once the swipe paged; cleared when the wheel goes quiet.
		let paged = false;
		let idle: number | undefined;
		const onWheel = (event: WheelEvent) => {
			if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
			event.preventDefault();
			window.clearTimeout(idle);
			idle = window.setTimeout(() => {
				sum = 0;
				paged = false;
			}, SWIPE_IDLE_MS);
			if (paged) return;
			sum += event.deltaX;
			if (Math.abs(sum) >= SWIPE_PX) {
				page.current(sum > 0 ? 1 : -1);
				sum = 0;
				paged = true;
			}
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel);
			window.clearTimeout(idle);
		};
	}, [enabled]);

	// Dragging: FullCalendar owns the pointer, so listen on the document.
	useEffect(() => {
		if (!dragging || !enabled) return undefined;
		let side: ScrollDirection | 0 = 0;
		let timer: number | undefined;
		const stop = () => {
			window.clearTimeout(timer);
			timer = undefined;
			side = 0;
		};
		const dwell = (direction: ScrollDirection, delay: number) => {
			timer = window.setTimeout(() => {
				page.current(direction);
				dwell(direction, REPEAT_MS);
			}, delay);
		};
		const onMove = (event: PointerEvent | MouseEvent) => {
			const bounds = ref.current?.getBoundingClientRect();
			if (!bounds) return;
			// Over the sidebar or below the grid is no edge of the calendar.
			const inside =
				event.clientX >= bounds.left &&
				event.clientX <= bounds.right &&
				event.clientY >= bounds.top &&
				event.clientY <= bounds.bottom;
			const next: ScrollDirection | 0 = !inside
				? 0
				: event.clientX <= bounds.left + EDGE_PX
					? -1
					: event.clientX >= bounds.right - EDGE_PX
						? 1
						: 0;
			setNear(next === -1 ? 'start' : next === 1 ? 'end' : null);
			if (next === side) return;
			stop();
			side = next;
			if (next) dwell(next, DWELL_MS);
		};
		document.addEventListener('pointermove', onMove);
		document.addEventListener('mousemove', onMove);
		return () => {
			stop();
			setNear(null);
			document.removeEventListener('pointermove', onMove);
			document.removeEventListener('mousemove', onMove);
		};
	}, [dragging, enabled]);

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === 'touch' || dragging) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - bounds.left;
		setNear(
			x <= EDGE_PX ? 'start' : x >= bounds.width - EDGE_PX ? 'end' : null
		);
	};

	return (
		<div
			ref={ref}
			className="calendarPager"
			data-cy={dataCy}
			data-dragging={dragging || undefined}
			onPointerMove={enabled ? onPointerMove : undefined}
			onPointerLeave={() => !dragging && setNear(null)}
		>
			{children}
			{enabled && (
				<>
					<EdgeArrow
						side="start"
						near={near === 'start'}
						label={t('calendar.previous')}
						onClick={() => onPage(-1)}
						data-cy={dataCy}
					/>
					<EdgeArrow
						side="end"
						near={near === 'end'}
						label={t('calendar.next')}
						onClick={() => onPage(1)}
						data-cy={dataCy}
					/>
				</>
			)}
		</div>
	);
};
