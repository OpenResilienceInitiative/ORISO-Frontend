import * as React from 'react';
import { CSSProperties, ReactNode } from 'react';
import { FilterChipRow } from './FilterChipRow';
import { FilterChip } from './FilterChip';
import {
	DisplayFilterKindOption,
	DisplayFilterValue,
	listedKinds,
	orderChipKinds,
	resolveChipPresentation,
	visiblePillKinds
} from './displayFilterTypes';

export interface FilterChipMenuLabels {
	/** Accessible name of the chip group, already translated. */
	group: string;
	/** Accessible name of a deactivated chip, e.g. "Gesprächskreis (vom Träger deaktiviert)". */
	deactivated: (chipName: string) => string;
}

export interface FilterChipMenuProps {
	/** The section's kinds in section order, with unread counts and availability. */
	kinds: ReadonlyArray<DisplayFilterKindOption>;
	/** The effective display filter of the section (pills, view, auto-sort). */
	value: DisplayFilterValue;
	activeKindId: string | null;
	labels: FilterChipMenuLabels;
	/** Toggle the chip filter of an available kind. */
	onToggle: (kindId: string) => void;
	/** A deactivated kind was clicked: show the Träger notice. */
	onDeactivatedClick: (kindId: string) => void;
	/** Chips rendered before the kind chips (e.g. Unread, Drafts of the sessions toolbar). */
	leading?: ReactNode;
	/** Pinned right end: the display-filter button. */
	trailing?: ReactNode;
	className?: string;
	style?: CSSProperties;
	scrollDataCy?: string;
	dataCyPrefix?: string;
	/** Icons are repo SVG assets (paths get `fill: currentcolor`). */
	assetIcons?: boolean;
}

const badgeName = (label: string, count: number | undefined): string => {
	const hasCount = count !== undefined && count > 0;
	return hasCount ? `${label} (${count > 99 ? '99+' : count})` : label;
};

/**
 * The chip menu under the list search field (#1377, Frank 2026-09-16): one
 * chip per shown kind whose pill is on — a chip is a menu entry, unread
 * items are its badge. The user picks the view (icon pills that expand
 * when active, or compact text pills) and whether unread kinds float left,
 * both stored on the section filter. Kinds the Träger switched off stay
 * listed while rows of that kind exist, locked, and route their click to
 * the notice; kinds that are off with no rows are not listed at all.
 */
export const FilterChipMenu = ({
	kinds,
	value,
	activeKindId,
	labels,
	onToggle,
	onDeactivatedClick,
	leading,
	trailing,
	className,
	style,
	scrollDataCy,
	dataCyPrefix = 'chip',
	assetIcons = false
}: FilterChipMenuProps) => {
	const { view, autoSort } = resolveChipPresentation(value);
	const chips = orderChipKinds(
		visiblePillKinds(value, listedKinds(kinds), activeKindId),
		{ autoSort }
	);
	return (
		<FilterChipRow
			label={labels.group}
			trailing={trailing}
			className={className}
			style={style}
			scrollDataCy={scrollDataCy}
		>
			{leading}
			{chips.map((kind) => {
				const deactivated = kind.availability === 'deactivated';
				return (
					<FilterChip
						key={kind.id}
						label={kind.chipLabel ?? kind.label}
						icon={kind.icon!}
						assetIcon={assetIcons}
						view={view}
						count={kind.unreadCount}
						active={activeKindId === kind.id}
						deactivated={deactivated}
						deactivatedLabel={labels.deactivated(
							badgeName(
								kind.chipLabel ?? kind.label,
								kind.unreadCount
							)
						)}
						onClick={() => onToggle(kind.id)}
						onDeactivatedClick={() => onDeactivatedClick(kind.id)}
						data-cy={`${dataCyPrefix}-${kind.id}`}
					/>
				);
			})}
		</FilterChipRow>
	);
};
