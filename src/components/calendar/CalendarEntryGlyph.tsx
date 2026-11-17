/**
 * The symbol of one calendar entry. Kinds reuse the timeline glyphs; group
 * dates, blocked time and colleagues' busy time get their own. The calendar
 * tells entries apart by these symbols, not by colour (Frank, 2026-11-14).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
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

/**
 * Whether the display filter shows a facet: not hidden, and among the
 * "only these" kinds when some are chosen. The grid and the search use
 * the same rule, so search finds nothing the grid would not show.
 */
export const facetShown = (
	facet: CalendarEntryFacet,
	onlyFacets: CalendarEntryFacet[],
	hiddenFacets: CalendarEntryFacet[]
) =>
	!hiddenFacets.includes(facet) &&
	(onlyFacets.length === 0 || onlyFacets.includes(facet));

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

/**
 * "Beginnt gleich" with a clock: the soon state in words, so it does not
 * rest on the red fill alone, and part of the entry's accessible name
 * (review 4577641949).
 */
export const SoonBadge = () => {
	const { t } = useTranslation();
	return (
		<span className="calendarSoon" data-cy="calendar-soon">
			<ScheduleIcon className="calendarSoon__icon" aria-hidden />
			<span className="calendarSoon__text">{t('calendar.soon')}</span>
		</span>
	);
};
