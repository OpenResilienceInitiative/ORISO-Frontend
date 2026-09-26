import * as React from 'react';
import { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { findActiveChips, revealChip } from './chipRowReveal';
import './displayFilter.styles.scss';

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
		const resize =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(() => {
						if (!pending || !laidOut()) return;
						const chip = pending;
						pending = null;
						if (chip.isConnected) revealChip(scroller, chip);
					});
		resize?.observe(scroller);
		scroller.addEventListener('transitionend', onTransitionEnd);
		onMutation();
		return () => {
			observer.disconnect();
			resize?.disconnect();
			scroller.removeEventListener('transitionend', onTransitionEnd);
		};
	}, []);

	return (
		<div className={clsx('filterChipRow', className)} style={style}>
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
			{trailing && (
				<div className="filterChipRow__trailing">{trailing}</div>
			)}
		</div>
	);
};
