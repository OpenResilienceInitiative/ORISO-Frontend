/**
 * The grip where the morning off-time ends and the evening off-time starts
 * (Frank's prototype, 2026-11-14): drag it, in quarter hours with a live
 * time label, or press the arrow keys, and the page asks whether the new
 * time holds "Nur an diesem Tag" or "Immer <Wochentag>s". Own calendar only.
 *
 * The grip sits inside FullCalendar's grid and inside the own column of the
 * side-by-side view, both of which select a range on pointer down. Its
 * pointer listeners are native and stop there, so neither grid starts a
 * selection underneath.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
	EDGE_STEP_MINUTES,
	clampEdge,
	minutesOf,
	timeOfMinutes,
	type TimeWindow
} from './calendarWorkingHours';
import { dateKeyOf } from './calendarHolidays';
import { calendarLocale } from './calendarLocale';

export type WorkEdge = 'start' | 'end';

/** A grip was let go (or moved by key) at a new time. */
export interface EdgeChange {
	edge: WorkEdge;
	/** The local day, midnight. */
	day: Date;
	/** HH:mm before */
	from: string;
	/** HH:mm after */
	to: string;
}

/** Where the day column the grip belongs to sits on screen. */
export interface GripGeometry {
	top: number;
	left: number;
	width: number;
	height: number;
	/** Minutes since midnight at the top and the bottom edge. */
	firstMinute: number;
	lastMinute: number;
}

export interface CalendarWorkGripProps {
	edge: WorkEdge;
	day: Date;
	/** HH:mm the edge is at now. */
	time: string;
	/** The day's working windows, to keep at least an hour of work. */
	windows: TimeWindow[];
	/** The date has its own hours ("Nur an diesem Tag"): primary colour. */
	exception?: boolean;
	measure: (grip: HTMLElement) => GripGeometry | null;
	onChange: (change: EdgeChange, anchor: { x: number; y: number }) => void;
	className?: string;
	style?: React.CSSProperties;
}

const STOPPED = ['mousedown', 'touchstart', 'click', 'dblclick'] as const;

export const CalendarWorkGrip = ({
	edge,
	day,
	time,
	windows,
	exception = false,
	measure,
	onChange,
	className,
	style
}: CalendarWorkGripProps) => {
	const { t, i18n } = useTranslation();
	const ref = useRef<HTMLButtonElement>(null);
	const [drag, setDrag] = useState<{
		minutes: number;
		geometry: GripGeometry;
	} | null>(null);
	// The listeners are attached once; they read the latest props here.
	const latest = useRef({ edge, day, time, windows, measure, onChange });
	latest.current = { edge, day, time, windows, measure, onChange };

	useEffect(() => {
		const el = ref.current;
		if (!el) return undefined;
		const stop = (event: Event) => event.stopPropagation();
		let cleanup: (() => void) | undefined;
		const down = (event: PointerEvent) => {
			event.stopPropagation();
			if (event.button !== 0) return;
			event.preventDefault();
			const { measure: measureNow } = latest.current;
			const geometry = measureNow(el);
			if (!geometry) return;
			const minutesAt = (clientY: number) => {
				const { edge: e, windows: w } = latest.current;
				const span = geometry.lastMinute - geometry.firstMinute;
				const raw =
					geometry.firstMinute +
					((clientY - geometry.top) / geometry.height) * span;
				return clampEdge(
					w,
					e,
					Math.max(
						geometry.firstMinute,
						Math.min(geometry.lastMinute, raw)
					)
				);
			};
			let minutes = minutesOf(latest.current.time);
			try {
				el.setPointerCapture(event.pointerId);
			} catch {
				// jsdom and old browsers: the move listeners still work.
			}
			setDrag({ minutes, geometry });
			const move = (e: PointerEvent) => {
				minutes = minutesAt(e.clientY);
				setDrag({ minutes, geometry });
			};
			const up = (e: PointerEvent) => {
				cleanup?.();
				setDrag(null);
				const {
					edge: currentEdge,
					day: currentDay,
					time: from,
					onChange: notify
				} = latest.current;
				const to = timeOfMinutes(minutes);
				if (e.type === 'pointerup' && to !== from)
					notify(
						{ edge: currentEdge, day: currentDay, from, to },
						{ x: e.clientX + 8, y: e.clientY + 8 }
					);
			};
			el.addEventListener('pointermove', move);
			el.addEventListener('pointerup', up);
			el.addEventListener('pointercancel', up);
			cleanup = () => {
				el.removeEventListener('pointermove', move);
				el.removeEventListener('pointerup', up);
				el.removeEventListener('pointercancel', up);
				cleanup = undefined;
			};
		};
		el.addEventListener('pointerdown', down);
		STOPPED.forEach((type) => el.addEventListener(type, stop));
		return () => {
			cleanup?.();
			el.removeEventListener('pointerdown', down);
			STOPPED.forEach((type) => el.removeEventListener(type, stop));
		};
	}, []);

	const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
		event.preventDefault();
		event.stopPropagation();
		const step =
			event.key === 'ArrowUp' ? -EDGE_STEP_MINUTES : EDGE_STEP_MINUTES;
		const next = timeOfMinutes(
			clampEdge(windows, edge, minutesOf(time) + step)
		);
		if (next === time) return;
		const rect = event.currentTarget.getBoundingClientRect();
		onChange(
			{ edge, day, from: time, to: next },
			{ x: rect.right + 8, y: rect.top }
		);
	};

	const locale = calendarLocale(i18n.language);
	const date = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'numeric'
	}).format(day);
	const what = t(
		edge === 'start' ? 'calendar.grip.start' : 'calendar.grip.end'
	);
	const ghostTime = drag ? timeOfMinutes(drag.minutes) : '';
	const ghostTop = drag
		? drag.geometry.top +
			((drag.minutes - drag.geometry.firstMinute) /
				(drag.geometry.lastMinute - drag.geometry.firstMinute)) *
				drag.geometry.height
		: 0;

	return (
		<>
			<button
				ref={ref}
				type="button"
				className={[
					'calendarGrip',
					`calendarGrip--${edge}`,
					exception && 'calendarGrip--exception',
					drag && 'calendarGrip--dragging',
					className
				]
					.filter(Boolean)
					.join(' ')}
				style={style}
				aria-label={t('calendar.grip.label', { what, date, time })}
				title={
					exception
						? t('calendar.grip.titleException', { what, time })
						: t('calendar.grip.title', { what, time })
				}
				onKeyDown={keyDown}
				data-grip={`${dateKeyOf(day)}-${edge}`}
				data-cy={`calendar-grip-${dateKeyOf(day)}-${edge}`}
			/>
			{drag &&
				createPortal(
					<div
						className="calendarGrip__ghost"
						style={{
							top: ghostTop,
							left: drag.geometry.left,
							width: drag.geometry.width
						}}
						data-cy="calendar-grip-ghost"
					>
						<span
							className="calendarGrip__ghostLabel"
							aria-hidden="true"
						>
							{t(
								edge === 'start'
									? 'calendar.grip.ghostStart'
									: 'calendar.grip.ghostEnd',
								{ time: ghostTime }
							)}
						</span>
					</div>,
					document.body
				)}
			{drag && (
				<span className="sr-only" role="status">
					{ghostTime}
				</span>
			)}
		</>
	);
};
