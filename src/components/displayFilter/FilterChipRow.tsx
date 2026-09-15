import * as React from 'react';
import { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
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
}: FilterChipRowProps) => (
	<div className={clsx('filterChipRow', className)} style={style}>
		<div
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
		{trailing && <div className="filterChipRow__trailing">{trailing}</div>}
	</div>
);
