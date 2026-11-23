import * as React from 'react';
import { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
	HoverScrollArrows,
	ScrollDirection
} from '../hoverScrollArrows/HoverScrollArrows';
import { findActiveChips, revealChip } from './chipRowReveal';
import './displayFilter.styles.scss';

/**
 * The scrollLeft at which each chip starts. The chips sit in one inner row,
 * so the arrows' default (the scroller's direct children) would see a single
 * target and never offer a step.
 */
export const chipTargets = (track: HTMLElement) => {
	const max = Math.max(0, track.scrollWidth - track.clientWidth);
	const origin = track.getBoundingClientRect().left - track.scrollLeft;
	const chips = Array.from(track.firstElementChild?.children ?? []);
	return chips.map((chip) =>
		Math.min(max, Math.max(0, chip.getBoundingClientRect().left - origin))
	);
};

/**
 * One click pages the row (#2390): forward, the first chip cut off on the
 * right starts the view; back, the chip cut off on the left ends it. So
 * every chip is fully visible at some step, not just a few at a time.
 */
export const pageChips = (
	track: HTMLElement | null,
	direction: ScrollDirection
) => {
	if (!track) return;
	const { scrollLeft, clientWidth } = track;
	const origin = track.getBoundingClientRect().left - scrollLeft;
	const spans = Array.from(track.firstElementChild?.children ?? []).map(
		(chip) => {
			const { left, right } = chip.getBoundingClientRect();
			return { left: left - origin, right: right - origin };
		}
	);
	const cut =
		direction === 1
			? spans.find((span) => span.right > scrollLeft + clientWidth + 1)
			: [...spans].reverse().find((span) => span.left < scrollLeft - 1);
	const target = cut
		? direction === 1
			? cut.left
			: cut.right - clientWidth
		: undefined;
	// A chip wider than the row would not move it: page a row width instead.
	const moves = target !== undefined && direction * (target - scrollLeft) > 1;
	track.scrollTo({
		left: moves ? target : scrollLeft + direction * clientWidth * 0.8
	});
};

export interface FilterChipRowProps {
	/**
	 * Accessible name of the chip group (already translated). When given the
	 * chips row is announced as a group; without it the row keeps the plain
	 * markup of today's toolbars.
	 */
	label?: string;
	/** The scrolling chips ({@link FilterChip} elements). */
	children: ReactNode;
	/**
	 * Pinned to the right end, outside the horizontal scroll: the display
	 * filter button and other row-level actions. The chips scroll under it.
	 */
	trailing?: ReactNode;
	className?: string;
	/** Inline style of the outer row (callers hide it while a dropdown is open). */
	style?: CSSProperties;
	/** `data-cy` of the scroll container, for the existing e2e selectors. */
	scrollDataCy?: string;
}

/**
 * The chip row under the list search field (#1377 slice 1). Same scroll
 * container as today's toolbars (`sessionsListToolbar__chipsScroll/__chipsRow`),
 * plus a pinned trailing slot for the display-filter button (spec §3: "it is
 * not a chip and must not scroll away with the chips").
 */
export const FilterChipRow = ({
	label,
	children,
	trailing,
	className,
	style,
	scrollDataCy
}: FilterChipRowProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);

	// A chip that becomes active scrolls itself into view (Frank 2026-09-21):
	// otherwise a half-hidden chip expands off-screen and the click looks dead.
	// Re-run after its width transition, which is what pushes it out.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller || typeof MutationObserver === 'undefined') return;
		// Only a NEWLY active chip scrolls: badge updates never yank a row the
		// user scrolled by hand, and a second active chip (Zeitstrahl family +
		// Ungelesen) still gets revealed.
		let active = new Set<HTMLElement>();
		let revealed: HTMLElement | null = null;
		// Chosen while the row was hidden (search panel open): measured once
		// the row has a size again.
		let pending: HTMLElement | null = null;
		const laidOut = () => scroller.clientWidth > 0;
		// The arrows span their wrapper, which also holds the gap under the
		// row (a per-page margin): end them at the chips so they centre on them.
		const syncArrowGap = () =>
			scroller.parentElement?.style.setProperty(
				'--filter-chip-row-gap',
				window.getComputedStyle(scroller).marginBottom
			);
		const reveal = (chip: HTMLElement) => {
			revealed = chip;
			if (!laidOut()) {
				pending = chip;
				return;
			}
			pending = null;
			revealChip(scroller, chip);
		};
		const onMutation = () => {
			const now = findActiveChips(scroller);
			const added = now.filter((chip) => !active.has(chip));
			active = new Set(now);
			if (added.length) reveal(added[added.length - 1]);
		};
		const onTransitionEnd = (event: TransitionEvent) => {
			if (
				revealed &&
				event.target === revealed &&
				event.propertyName === 'max-width' &&
				laidOut()
			)
				revealChip(scroller, revealed);
		};
		const observer = new MutationObserver(onMutation);
		observer.observe(scroller, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['aria-pressed', 'aria-current', 'class']
		});
		// Also re-check when the row narrows (list column dragged smaller), so
		// the active chip does not slide out; widening never moves the row.
		let lastWidth = scroller.clientWidth;
		const resize =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(() => {
						syncArrowGap();
						const width = scroller.clientWidth;
						const narrowed = width < lastWidth;
						lastWidth = width;
						if (!laidOut()) return;
						const chip =
							pending ??
							(narrowed && revealed && active.has(revealed)
								? revealed
								: null);
						pending = null;
						if (chip?.isConnected) revealChip(scroller, chip);
					});
		resize?.observe(scroller);
		scroller.addEventListener('transitionend', onTransitionEnd);
		syncArrowGap();
		onMutation();
		return () => {
			observer.disconnect();
			resize?.disconnect();
			scroller.removeEventListener('transitionend', onTransitionEnd);
		};
	}, []);

	return (
		<div className={clsx('filterChipRow', className)} style={style}>
			{/* The row hides its scrollbar, so a mouse without a trackpad
			    could only reach the last chips by clicking them one by one
			    (#2390): the shared desktop arrows page through the row. */}
			<HoverScrollArrows
				targetRef={scrollRef}
				targets={chipTargets}
				onStep={(direction) => pageChips(scrollRef.current, direction)}
				className="filterChipRow__arrows"
				data-cy="filter-chip-row-arrows"
			>
				<div
					ref={scrollRef}
					className="sessionsListToolbar__chipsScroll filterChipRow__scroll"
					data-cy={scrollDataCy}
				>
					<div
						className="sessionsListToolbar__chipsRow"
						role={label ? 'group' : undefined}
						aria-label={label}
					>
						{children}
					</div>
				</div>
			</HoverScrollArrows>
			{trailing && (
				<div className="filterChipRow__trailing">{trailing}</div>
			)}
		</div>
	);
};
