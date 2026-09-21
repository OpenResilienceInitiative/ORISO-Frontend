import * as React from 'react';
import { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { findActiveChip, revealChip } from './chipRowReveal';
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
		// Only a change of the active chip scrolls, so badge updates never
		// yank a row the user scrolled by hand.
		let revealed: HTMLElement | null = null;
		const onMutation = () => {
			const chip = findActiveChip(scroller);
			if (chip === revealed) return;
			revealed = chip;
			if (chip) revealChip(scroller, chip);
		};
		const onTransitionEnd = (event: TransitionEvent) => {
			if (
				revealed &&
				event.target === revealed &&
				event.propertyName === 'max-width'
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
		scroller.addEventListener('transitionend', onTransitionEnd);
		onMutation();
		return () => {
			observer.disconnect();
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
