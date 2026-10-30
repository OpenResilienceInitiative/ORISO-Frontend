/**
 * The future part of the chat-history list (ADR-021): twin cards of the
 * planned appointments above "Jetzt", opened by the vertical handle. Used by
 * the real `SessionsList` and by the Storybook prototype; each brings its own
 * card (`renderCard`), this zone owns the handle, the snap stops and the
 * split button laid over every twin.
 */
import * as React from 'react';
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { ResizableHandle } from '../ResizableHandle';
import { revealSnapPoints, stepSnap, clampReveal } from '../verticalHandleMath';
import {
	AppointmentSplitButton,
	type AppointmentAction
} from './AppointmentSplitButton';
import type { FutureEntry, TimelineRole } from './timelineModel';
import './futureZone.styles.scss';

export type NowVariant = 'line' | 'handle' | 'band';
/** How far the zone opens on first show (display setting). */
export type FutureReveal = 'none' | 'next' | 'half' | 'most';

/** Fallback card height until the real cards are measured. */
export const ENTRY_HEIGHT = 160;
/** Pull this far past the top of the single timeline to release the next stop. */
export const PULL_RELEASE_PX = 60;

/** Kept for the page's lifetime: a chat switch must not close the zone, a reload does. */
const rememberedReveal = new Map<string, number>();

export const resetRememberedRevealForTests = () => rememberedReveal.clear();

export interface TwinCardFlags {
	isBeforeActive: boolean;
	isAfterActive: boolean;
	isGroupStart: boolean;
	isGroupEnd: boolean;
}

export interface FutureZoneHandle {
	/** Single timeline: a pull past the top opens the next stop. */
	stepOpen: () => void;
}

export interface FutureZoneProps {
	/** Next appointment first (as `buildFutureEntries` returns them). */
	entries: FutureEntry[];
	role: TimelineRole;
	/** Height of the list below the handle: half / almost all of it are stops. */
	listHeight: number;
	/** The card of a twin; `index` counts from the furthest appointment. */
	renderCard: (
		entry: FutureEntry,
		index: number,
		flags: TwinCardFlags
	) => React.ReactNode;
	/** False: the card shows its split button itself (no room to open). */
	overlayAction?: (entry: FutureEntry) => boolean;
	selectedKey?: string;
	onSelect?: (entry: FutureEntry) => void;
	onAction?: AppointmentAction;
	initialReveal?: FutureReveal;
	/** Set: the opening survives a remount (chat switch) until the page reloads. */
	memoryKey?: string;
	emptyLabel?: string;
	label?: string;
}

export const NowArrow = ({ direction }: { direction: 'up' | 'down' }) => (
	<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
		<path
			d={direction === 'up' ? 'M6 2 L11 8 H1 Z' : 'M6 10 L1 4 H11 Z'}
			fill="currentColor"
		/>
	</svg>
);

export const NowMarker = ({
	variant,
	label = 'Jetzt'
}: {
	variant: NowVariant;
	label?: string;
}) => (
	<div
		className={`tlp__now tlp__now--${variant}`}
		data-cy="timeline-now"
		role="separator"
		aria-label={label}
	>
		{variant === 'band' && <NowArrow direction="up" />}
		<span className="tlp__nowLabel">{label}</span>
		{variant === 'band' && <NowArrow direction="down" />}
	</div>
);

/**
 * The split button sits where the twin card would show its last message.
 * It lives in a layer beside the card list (a list may only hold its items)
 * and is placed over its card. Its main part opens the room exactly like a
 * click on the card does.
 */
const TwinAction = ({
	entry,
	role,
	active,
	index,
	listRef,
	onAction
}: {
	entry: FutureEntry;
	role: TimelineRole;
	active: boolean;
	index: number;
	listRef: React.RefObject<HTMLDivElement>;
	onAction?: AppointmentAction;
}) => {
	const [place, setPlace] = useState<React.CSSProperties>({});
	const card = () =>
		listRef.current
			?.querySelectorAll<HTMLElement>(':scope > .tlp__row')
			[index]?.querySelector<HTMLElement>('.sessionsListItem__content');

	// The card fills in after mount (Matrix preview, avatars): measure again
	// whenever the row changes size or content.
	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const measure = () => {
			const row =
				list.querySelectorAll<HTMLElement>(':scope > .tlp__row')[index];
			if (!row) return;
			const r = row.getBoundingClientRect();
			const preview = row.querySelector<HTMLElement>(
				'.sessionsListItem__subject'
			);
			if (preview) {
				// The preview box spans the card; its text starts after the avatar.
				const text = document.createRange();
				text.selectNodeContents(preview);
				const p = text.getBoundingClientRect();
				// Top-aligned: the 32px button grows into the gap below the preview.
				setPlace({
					left: Math.round(p.left - r.left),
					top: Math.round(row.offsetTop + p.top - r.top - 2)
				});
				return;
			}
			// A room without messages yet: right under its name.
			const name = row.querySelector<HTMLElement>('.sessionCard__name');
			if (!name) return;
			const n = name.getBoundingClientRect();
			setPlace({
				left: Math.round(n.left - r.left),
				top: Math.round(row.offsetTop + n.bottom - r.top + 4)
			});
		};
		measure();
		const observer =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(measure)
				: null;
		observer?.observe(list);
		const mutations = new MutationObserver(measure);
		mutations.observe(list, { childList: true, subtree: true });
		return () => {
			observer?.disconnect();
			mutations.disconnect();
		};
	}, [index, listRef]);

	return (
		<div
			className="tlp__twinAction"
			style={place}
			data-cy="timeline-entry-action"
		>
			<AppointmentSplitButton
				entry={entry}
				role={role}
				active={active}
				onAction={onAction}
				onOpen={() => {
					card()?.click();
					card()?.focus();
				}}
			/>
		</div>
	);
};

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
			role,
			listHeight,
			renderCard,
			overlayAction = () => true,
			selectedKey,
			onSelect,
			onAction,
			initialReveal = 'none',
			memoryKey,
			emptyLabel = 'Keine geplanten Termine',
			label = 'Anstehende Termine'
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
		const futureRef = useRef<HTMLDivElement>(null);

		const setReveal = useCallback(
			(height: number) => {
				setRevealState(height);
				if (memoryKey) rememberedReveal.set(memoryKey, height);
			},
			[memoryKey]
		);

		// Furthest appointment first: the next one sits right above "Jetzt".
		const shownEntries = useMemo(() => [...entries].reverse(), [entries]);

		// Snap stops come from the real cards' height, not from a constant.
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
					content: Math.round(inner.scrollHeight)
				});
			};
			measure();
			const observer =
				typeof ResizeObserver !== 'undefined'
					? new ResizeObserver(measure)
					: null;
			observer?.observe(inner);
			return () => observer?.disconnect();
		}, [shownEntries.length, selectedKey]);

		const contentHeight = shownEntries.length ? measured.content : 0;
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
		// once the cards have been measured.
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

		const isActive = (index: number) =>
			index >= 0 &&
			index < shownEntries.length &&
			shownEntries[index].key === selectedKey;

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
						role={shownEntries.length ? 'list' : 'group'}
						aria-label={label}
					>
						{shownEntries.length === 0 ? (
							<p className="tlp__empty">{emptyLabel}</p>
						) : (
							shownEntries.map((entry, index) => (
								<div
									key={entry.key}
									className="tlp__row"
									onClickCapture={() => onSelect?.(entry)}
								>
									{renderCard(entry, index, {
										isBeforeActive: isActive(index + 1),
										isAfterActive: isActive(index - 1),
										isGroupStart:
											index === 0 || isActive(index - 1),
										isGroupEnd:
											index === shownEntries.length - 1 ||
											isActive(index + 1)
									})}
								</div>
							))
						)}
					</div>
					<div
						className="tlp__futureActions"
						style={{ bottom: contentHeight }}
						data-cy="timeline-entry-actions"
					>
						{shownEntries.map((entry, index) =>
							overlayAction(entry) ? (
								<TwinAction
									key={entry.key}
									entry={entry}
									role={role}
									active={entry.key === selectedKey}
									index={index}
									listRef={futureRef}
									onAction={onAction}
								/>
							) : null
						)}
					</div>
				</div>
				<div className="tlp__handleHost">
					<ResizableHandle
						orientation="vertical"
						height={shown}
						maxHeight={contentHeight}
						snapPoints={snapPoints}
						onResize={onResize}
					/>
				</div>
			</div>
		);
	}
);

FutureZone.displayName = 'FutureZone';
