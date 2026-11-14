/**
 * Phone: the left column of "Meine Termine" (search, "Als Nächstes", open
 * requests, quick entry, working hours) becomes a bottom sheet over the
 * calendar (Frank's prototype, 2026-11-14). It stops at peek (64 px), half
 * (46 %) and full (88 %) of the page. The grab handle drags it, a flick moves
 * one stop on, a tap toggles peek and half; as a button it cycles the stops
 * with Enter or Space and moves them with the arrow keys.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SheetStop = 'peek' | 'half' | 'full';

export const SHEET_STOPS: SheetStop[] = ['peek', 'half', 'full'];
export const SHEET_PEEK_PX = 64;
const SHEET_SHARE: Record<Exclude<SheetStop, 'peek'>, number> = {
	half: 0.46,
	full: 0.88
};
/** Less than this is a tap, not a drag. */
const TAP_PX = 6;
/** A drag this long that ends near where it began still moves one stop. */
const FLICK_PX = 40;

/** The height of a stop on a page `pageHeight` tall. */
export const sheetHeight = (stop: SheetStop, pageHeight: number) =>
	stop === 'peek'
		? SHEET_PEEK_PX
		: Math.max(SHEET_PEEK_PX, Math.round(pageHeight * SHEET_SHARE[stop]));

/**
 * Where the sheet goes when the grab is let go: a tap toggles peek and
 * half, a flick goes one stop in its direction, anything else to the
 * nearest stop. `dy` is the pointer's way down (negative = up).
 */
export const sheetStopAfterDrag = ({
	from,
	height,
	dy,
	pageHeight
}: {
	from: SheetStop;
	height: number;
	dy: number;
	pageHeight: number;
}): SheetStop => {
	if (Math.abs(dy) < TAP_PX) return from === 'peek' ? 'half' : 'peek';
	const nearest = SHEET_STOPS.map(
		(stop) =>
			[stop, Math.abs(sheetHeight(stop, pageHeight) - height)] as const
	).sort((a, b) => a[1] - b[1])[0][0];
	if (Math.abs(dy) > FLICK_PX && nearest === from) {
		const index = SHEET_STOPS.indexOf(from) + (dy < 0 ? 1 : -1);
		return SHEET_STOPS[
			Math.max(0, Math.min(SHEET_STOPS.length - 1, index))
		];
	}
	return nearest;
};

/** Enter or Space on the grab: peek → half → full → peek. */
export const nextSheetStop = (stop: SheetStop): SheetStop =>
	SHEET_STOPS[(SHEET_STOPS.indexOf(stop) + 1) % SHEET_STOPS.length];

export interface CalendarSheetProps {
	stop: SheetStop;
	onStop: (stop: SheetStop) => void;
	/** Accessible name of the sheet region. */
	label: string;
	id?: string;
	children: React.ReactNode;
}

export const CalendarSheet = ({
	stop,
	onStop,
	label,
	id = 'calendar-sheet',
	children
}: CalendarSheetProps) => {
	const { t } = useTranslation();
	const sheetRef = useRef<HTMLElement>(null);
	const [pageHeight, setPageHeight] = useState(0);
	/** While dragging: the height under the finger. */
	const [dragHeight, setDragHeight] = useState<number | null>(null);
	const drag = useRef<{ y: number; height: number } | null>(null);

	useEffect(() => {
		const page = sheetRef.current?.parentElement;
		if (!page) return undefined;
		setPageHeight(page.clientHeight);
		if (typeof ResizeObserver === 'undefined') return undefined;
		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() =>
				setPageHeight(page.clientHeight)
			);
		});
		observer.observe(page);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (stop === 'peek' && sheetRef.current) sheetRef.current.scrollTop = 0;
	}, [stop]);

	const height =
		dragHeight ?? (pageHeight ? sheetHeight(stop, pageHeight) : undefined);

	const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (event.button !== 0) return;
		const start = sheetRef.current?.offsetHeight ?? 0;
		drag.current = { y: event.clientY, height: start };
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// jsdom: capture is optional.
		}
	};
	const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (!drag.current) return;
		const next = drag.current.height - (event.clientY - drag.current.y);
		setDragHeight(
			Math.max(
				SHEET_PEEK_PX,
				Math.min(sheetHeight('full', pageHeight), next)
			)
		);
	};
	const pointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
		const started = drag.current;
		drag.current = null;
		if (!started) return;
		const dy = event.clientY - started.y;
		const ended = dragHeight ?? started.height;
		setDragHeight(null);
		if (event.type === 'pointercancel') return;
		onStop(
			sheetStopAfterDrag({ from: stop, height: ended, dy, pageHeight })
		);
	};

	const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		const index = SHEET_STOPS.indexOf(stop);
		if (event.key === 'ArrowUp' && index < SHEET_STOPS.length - 1) {
			event.preventDefault();
			onStop(SHEET_STOPS[index + 1]);
		} else if (event.key === 'ArrowDown' && index > 0) {
			event.preventDefault();
			onStop(SHEET_STOPS[index - 1]);
		}
	};

	return (
		<section
			ref={sheetRef}
			id={id}
			className={[
				'calendarSheet',
				`calendarSheet--${stop}`,
				dragHeight !== null && 'calendarSheet--dragging'
			]
				.filter(Boolean)
				.join(' ')}
			style={height !== undefined ? { height } : undefined}
			aria-label={label}
			onKeyDown={(event) => {
				// All the way up it covers the calendar; Escape lowers it.
				if (event.key === 'Escape' && stop === 'full') {
					event.stopPropagation();
					onStop('half');
				}
			}}
			data-stop={stop}
			data-cy="calendar-sheet"
		>
			<button
				type="button"
				className="calendarSheet__grab"
				aria-controls={id}
				aria-label={t(
					stop === 'peek'
						? 'calendar.sheet.open'
						: stop === 'half'
							? 'calendar.sheet.half'
							: 'calendar.sheet.full'
				)}
				aria-describedby={`${id}-keys`}
				onPointerDown={pointerDown}
				onPointerMove={pointerMove}
				onPointerUp={pointerUp}
				onPointerCancel={pointerUp}
				onClick={(event) => {
					// Keyboard (Enter, Space) clicks have no detail; a pointer
					// tap is handled on pointer up.
					if (event.detail === 0) onStop(nextSheetStop(stop));
				}}
				onKeyDown={keyDown}
				data-cy="calendar-sheet-grab"
			>
				<span aria-hidden="true" />
			</button>
			<span id={`${id}-keys`} className="sr-only">
				{t('calendar.sheet.keys')}
			</span>
			{children}
		</section>
	);
};
