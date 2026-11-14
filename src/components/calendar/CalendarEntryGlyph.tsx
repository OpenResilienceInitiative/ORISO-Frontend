/**
 * The symbol of one calendar entry. Kinds reuse the timeline glyphs; group
 * dates, blocked time and colleagues' busy time get their own. The calendar
 * tells entries apart by these symbols, not by colour (Frank, 2026-11-14).
 */
import * as React from 'react';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import { ReactComponent as GroupsIcon } from '../../resources/img/icons/groups.svg';
import { AppointmentKindGlyph } from '../sessionsList/timeline/AppointmentKindGlyph';
import { MODALITY_BY_KIND, type CalendarEntry } from './calendarModel';

/** What a filter chip or a glyph stands for. */
export type CalendarEntryFacet =
	| 'video'
	| 'phone'
	| 'onsite'
	| 'chat'
	| 'group'
	| 'blocker';

export const CALENDAR_FACETS: CalendarEntryFacet[] = [
	'video',
	'phone',
	'onsite',
	'chat',
	'group',
	'blocker'
];

/** Imported busy time counts as blocked time for filtering. */
export const facetOf = (entry: CalendarEntry): CalendarEntryFacet => {
	if (entry.type === 'group') return 'group';
	if (entry.type === 'blocker' || entry.type === 'busy') return 'blocker';
	return entry.kind ?? 'video';
};

export const FacetIcon = ({
	facet,
	...props
}: { facet: CalendarEntryFacet } & React.SVGProps<SVGSVGElement>) => {
	if (facet === 'group')
		return <GroupsIcon aria-hidden="true" focusable="false" {...props} />;
	if (facet === 'blocker')
		return <BlockOutlinedIcon aria-hidden="true" focusable="false" />;
	return <AppointmentKindGlyph modality={MODALITY_BY_KIND[facet]} />;
};

/** For FilterChip, which takes a component rather than an element. */
export const FACET_ICON_COMPONENT: Record<
	CalendarEntryFacet,
	React.ComponentType<React.SVGProps<SVGSVGElement>>
> = Object.fromEntries(
	CALENDAR_FACETS.map((facet) => [
		facet,
		(props: React.SVGProps<SVGSVGElement>) => (
			<FacetIcon facet={facet} {...props} />
		)
	])
) as never;

export const CalendarEntryGlyph = ({
	entry,
	colleague
}: {
	entry: CalendarEntry;
	colleague?: boolean;
}) => {
	if (
		entry.type === 'busy' ||
		(colleague && !entry.kind && entry.type !== 'group')
	)
		return <EventBusyOutlinedIcon aria-hidden="true" focusable="false" />;
	return <FacetIcon facet={facetOf(entry)} />;
};
