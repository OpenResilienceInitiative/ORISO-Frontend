/**
 * The future part of the chat-history list (ADR-021): a pill per planned
 * appointment above "Jetzt". "Jetzt" itself is the handle that opens them, so
 * the zone owns the snap stops, the grip and the line it sits on. Used by the
 * real `SessionsList` and by the Storybook prototype.
 */
import * as React from 'react';
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState
} from 'react';
import { ResizableHandle } from '../ResizableHandle';
import { revealSnapPoints, stepSnap, clampReveal } from '../verticalHandleMath';
import type { AppointmentAction } from './AppointmentSplitButton';
import { FutureEntryPill } from './FutureEntryPill';
import { hasEnded, type FutureEntry, type TimelineRole } from './timelineModel';
import './futureZone.styles.scss';

/** How far the zone opens on first show (display setting). */
export type FutureReveal = 'none' | 'next' | 'half' | 'most';

/** Fallback row height until the real pills are measured. */
export const ENTRY_HEIGHT = 50;
/** Pull this far past the top of the single timeline to release the next stop. */
export const PULL_RELEASE_PX = 60;
/** The zone never takes more of the list than this; it scrolls inside. */
const MAX_LIST_SHARE = 0.85;
/** Countdown and red state move on without a reload. */
const CLOCK_TICK_MS = 30_000;

/** Kept for the page's lifetime: a chat switch must not close the zone, a reload does. */
const rememberedReveal = new Map<string, number>();

export const resetRememberedRevealForTests = () => rememberedReveal.clear();

export interface FutureZoneHandle {
	/** Single timeline: a pull past the top opens the next stop. */
	stepOpen: () => void;
}

/** A row from another source (an add-on), placed by time between the entries. */
export interface FutureZoneExtraRow {
	key: string;
	start: Date;
	end?: Date;
	render: (now: Date) => React.ReactNode;
}

type ZoneRow =
	| { key: string; start: Date; entry: FutureEntry }
	| { key: string; start: Date; extra: FutureZoneExtraRow };

export interface FutureZoneProps {
	/** Next appointment first (as `buildFutureEntries` returns them). */
	entries: FutureEntry[];
	extraRows?: FutureZoneExtraRow[];
	role: TimelineRole;
	/** Height of the list below the handle: half / almost all of it are stops. */
	listHeight: number;
	selectedKey?: string;
	/** A pill with a room was clicked. */
	onOpen?: (entry: FutureEntry) => void;
	/** A menu entry was chosen (cancel, duplicate, configure, ...). */
	onAction?: AppointmentAction;
	/** Whether the entry's room has unread messages. */
	unreadOf?: (entry: FutureEntry) => boolean;
	initialReveal?: FutureReveal;
	/** Set: the opening survives a remount (chat switch) until the page reloads. */
	memoryKey?: string;
	label?: string;
	/** The grip's visible word, translated by the host. */
	nowLabel?: string;
	/** Single timeline: where "Jetzt" sits, to jump back to it. */
	nowRef?: React.Ref<HTMLDivElement>;
	/** Stories pin the clock; the real list runs on the real one. */
	fixedNow?: Date;
}

const revealTarget = (
	reveal: FutureReveal,
	itemHeight: number,
	listHeight: number
): number =>
	({
		none: 0,
		next: itemHeight,
		half: Math.round(listHeight * 0.5),
		most: Math.round(listHeight * 0.85)
	})[reveal];

export const FutureZone = forwardRef<FutureZoneHandle, FutureZoneProps>(
	(
		{
			entries,
			extraRows,
			role,
			listHeight,
			selectedKey,
			onOpen,
			onAction,
			unreadOf,
			initialReveal = 'none',
			memoryKey,
			label = 'Anstehende Termine',
			nowLabel = 'Jetzt',
			nowRef,
			fixedNow
		},
		ref
	) => {
		const [reveal, setRevealState] = useState(() =>
			memoryKey ? (rememberedReveal.get(memoryKey) ?? -1) : -1
		);
		const [dragging, setDragging] = useState(false);
		const [measured, setMeasured] = useState({
			item: ENTRY_HEIGHT,
			content: 0
		});
		const [tick, setTick] = useState(() => new Date());
		const now = fixedNow ?? tick;
		const futureRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			const timer = window.setInterval(
				() => setTick(new Date()),
				CLOCK_TICK_MS
			);
			return () => window.clearInterval(timer);
		}, []);

		const setReveal = useCallback(
			(height: number) => {
				setRevealState(height);
				if (memoryKey) rememberedReveal.set(memoryKey, height);
			},
			[memoryKey]
		);

		// Furthest appointment first: the next one sits right above "Jetzt".
		const shownEntries = useMemo<ZoneRow[]>(
			() =>
				[
					...entries.map((entry) => ({
						key: entry.key,
						start: entry.start,
						entry
					})),
					...(extraRows ?? []).map((extra) => ({
						key: extra.key,
						start: extra.start,
						extra
					}))
				]
					.filter(
						(row) =>
							!hasEnded(
								'entry' in row ? row.entry : row.extra,
								now
							)
					)
					.sort((a, b) => a.start.getTime() - b.start.getTime())
					.reverse(),
			[entries, extraRows, now]
		);

		// Snap stops come from the real pills' height, not from a constant.
		useEffect(() => {
			const inner = futureRef.current;
			if (!inner) return;
			const measure = () => {
				const rows = inner.querySelectorAll<HTMLElement>('.tlp__row');
				const last = rows[rows.length - 1];
				setMeasured({
					// From the next appointment's top edge to the handle.
					item: last
						? Math.round(inner.offsetHeight - last.offsetTop)
						: ENTRY_HEIGHT,
					content: Math.round(inner.offsetHeight)
				});
			};
			measure();
			const observer =
				typeof ResizeObserver !== 'undefined'
					? new ResizeObserver(measure)
					: null;
			observer?.observe(inner);
			return () => observer?.disconnect();
		}, [shownEntries.length]);

		const contentHeight = shownEntries.length
			? Math.min(
					measured.content,
					Math.round(listHeight * MAX_LIST_SHARE)
				)
			: 0;
		const snapPoints = useMemo(
			() =>
				revealSnapPoints({
					itemHeight: measured.item,
					listHeight,
					contentHeight
				}),
			[measured.item, listHeight, contentHeight]
		);

		// First show on this page: open as far as the display setting says,
		// once the pills have been measured.
		useEffect(() => {
			if (reveal >= 0 || contentHeight <= 0) return;
			setReveal(
				clampReveal(
					revealTarget(initialReveal, measured.item, listHeight),
					contentHeight
				)
			);
		}, [
			reveal,
			contentHeight,
			initialReveal,
			measured.item,
			listHeight,
			setReveal
		]);

		// A filter with fewer appointments closes what no longer exists.
		// While dragging the stretch past the last item is shown; at rest it is cut off.
		const height = Math.max(reveal, 0);
		const shown = dragging ? height : clampReveal(height, contentHeight);

		const onResize = useCallback(
			(next: number, meta: { final: boolean }) => {
				setDragging(!meta.final);
				setReveal(next);
			},
			[setReveal]
		);

		useImperativeHandle(
			ref,
			() => ({
				stepOpen: () => setReveal(stepSnap(shown, snapPoints, 1))
			}),
			[shown, snapPoints, setReveal]
		);

		return (
			<div className="tlp__boundary" data-cy="timeline-boundary">
				<div
					className="tlp__future"
					data-dragging={dragging ? 'true' : 'false'}
					style={{ height: shown }}
					data-cy="timeline-future"
				>
					<div
						ref={futureRef}
						className="tlp__futureInner"
						role="list"
						aria-label={label}
					>
						{shownEntries.map((row) => (
							<div
								key={row.key}
								className="tlp__row"
								role="listitem"
							>
								{'entry' in row ? (
									<FutureEntryPill
										entry={row.entry}
										role={role}
										now={now}
										selected={row.key === selectedKey}
										unread={unreadOf?.(row.entry)}
										onOpen={onOpen}
										onAction={onAction}
									/>
								) : (
									row.extra.render(now)
								)}
							</div>
						))}
					</div>
				</div>
				<div ref={nowRef} className="tlp__now" data-cy="timeline-now">
					<ResizableHandle
						orientation="vertical"
						className="tlp__nowGrip"
						height={shown}
						maxHeight={contentHeight}
						snapPoints={snapPoints}
						onResize={onResize}
						grip={<span className="tlp__nowTag">{nowLabel}</span>}
					/>
				</div>
			</div>
		);
	}
);

FutureZone.displayName = 'FutureZone';
