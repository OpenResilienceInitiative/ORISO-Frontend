/**
 * The small card that explains an entry without opening it: on a
 * colleague's entry in the grid (name, Beratungsstelle, kind, time) and on
 * a row of "Als Nächstes" (kind, person, full time, place). Shown at once on
 * hover and on keyboard focus (Frank, 2026-11-14).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEntry, Colleague } from './calendarModel';
import { CalendarEntryGlyph, facetOf } from './CalendarEntryGlyph';
import type { MoveProposal } from './calendarActions';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';

/** "A. Kaya" → "AK", "ruhiges_yak" → "RY". */
export const initialsOf = (name: string) =>
	name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]!.toUpperCase())
		.join('');

export interface CalendarEntryPeekProps {
	entry: CalendarEntry;
	/** Set when the entry is a colleague's. */
	colleague?: Colleague;
	proposal?: MoveProposal;
	/** "Klick öffnet die Aktionen" under the card (Als Nächstes). */
	clickHint?: boolean;
	role?: 'tooltip';
	id?: string;
}

export const CalendarEntryPeek = ({
	entry,
	colleague,
	proposal,
	clickHint,
	role,
	id
}: CalendarEntryPeekProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	const facet = facetOf(entry);
	const kindLabel =
		entry.type === 'appointment'
			? t(`calendar.kinds.${entry.kind ?? 'video'}`)
			: t(`calendar.types.${entry.type}`);
	const when = (start: string | Date, end: string | Date) =>
		entry.allDay
			? `${format(start).split(',')[0]}, ${t('calendar.allDay')}`
			: format(start, end);
	const person = colleague?.displayName ?? label(entry, !!colleague);
	return (
		<div
			className={`calendarPeek calendarPeek--k-${facet}`}
			role={role}
			id={id}
		>
			<span className="calendarPeek__tag">
				<span className="calendarPeek__tagIcon" aria-hidden="true">
					<CalendarEntryGlyph entry={entry} colleague={!!colleague} />
				</span>
				{proposal ? t('calendar.proposal.label') : kindLabel}
			</span>
			<span className="calendarPeek__person">
				<span className="calendarPeek__avatar" aria-hidden="true">
					{initialsOf(person)}
				</span>
				<span className="calendarPeek__name">
					<strong>{person}</strong>
					{colleague?.agencyShort && (
						<span
							className="calendarPeek__agencyShort"
							title={colleague.agencyName}
						>
							{colleague.agencyShort}
						</span>
					)}
				</span>
			</span>
			{colleague && (
				<span className="calendarPeek__line">
					{colleague.agencyName}
					{entry.type === 'appointment' && ` · ${label(entry, true)}`}
				</span>
			)}
			<span className="calendarPeek__line">
				{proposal
					? t('calendar.proposal.proposed', {
							date: when(proposal.start, proposal.end)
						})
					: when(entry.start, entry.end)}
			</span>
			{proposal && (
				<span className="calendarPeek__line calendarPeek__line--muted">
					{t('calendar.proposal.waiting')}
				</span>
			)}
			{!colleague && entry.address && (
				<span className="calendarPeek__line">{entry.address}</span>
			)}
			{clickHint && (
				<span className="calendarPeek__hint">
					{t('calendar.peek.hint')}
				</span>
			)}
		</div>
	);
};
