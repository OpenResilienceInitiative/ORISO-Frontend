import * as React from 'react';
import { ReactNode } from 'react';
import clsx from 'clsx';
import './displayFilter.styles.scss';

export interface FilterChipRowProps {
	/** Accessible name of the chip group (already translated). */
	label: string;
	/** The scrolling chips ({@link FilterChip} elements). */
	children: ReactNode;
	/**
	 * Pinned to the right end, outside the horizontal scroll: the display
	 * filter button and other row-level actions. The chips scroll under it.
	 */
	trailing?: ReactNode;
	className?: string;
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
	className
}: FilterChipRowProps) => (
	<div className={clsx('filterChipRow', className)}>
		<div className="sessionsListToolbar__chipsScroll filterChipRow__scroll">
			<div
				className="sessionsListToolbar__chipsRow"
				role="group"
				aria-label={label}
			>
				{children}
			</div>
		</div>
		{trailing && <div className="filterChipRow__trailing">{trailing}</div>}
	</div>
);
