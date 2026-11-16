/**
 * One entry, opened from the calendar or the "Als Nächstes" list. The kind
 * decides the start action (ADR-032 §2a); on-site shows the address instead.
 * A colleague's entry shows only what §3 allows.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog, type M3DialogAction } from '../m3Dialog/M3Dialog';
import type { CalendarEntry, CalendarRole } from './calendarModel';
import { CalendarEntryGlyph } from './CalendarEntryGlyph';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';

export interface EntryDetailsDialogProps {
	entry: CalendarEntry | null;
	role: CalendarRole;
	ownerId: string;
	colleagueName?: string;
	fullScreen?: boolean;
	onStart?: (entry: CalendarEntry) => void;
	onCancelAppointment?: (entry: CalendarEntry) => void;
	onRemoveBlocker?: (entry: CalendarEntry) => void;
	onClose: () => void;
}

export const EntryDetailsDialog = ({
	entry,
	role,
	ownerId,
	colleagueName,
	fullScreen,
	onStart,
	onCancelAppointment,
	onRemoveBlocker,
	onClose
}: EntryDetailsDialogProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	if (!entry) return null;
	const colleague = entry.ownerId !== ownerId;
	const consultant = role === 'consultant';

	const actions: M3DialogAction[] = [];
	if (!colleague && entry.type === 'appointment') {
		if (consultant)
			actions.push({
				label: t('calendar.details.cancel'),
				onClick: () => onCancelAppointment?.(entry),
				testId: 'calendar-entry-cancel'
			});
		if (entry.kind && entry.kind !== 'onsite')
			actions.push({
				label: t(
					`calendar.details.${consultant ? 'start' : 'join'}.${entry.kind}`
				),
				onClick: () => onStart?.(entry),
				primary: true,
				testId: 'calendar-entry-start'
			});
	}
	if (!colleague && entry.type === 'blocker' && consultant)
		actions.push({
			label: t('calendar.details.remove'),
			onClick: () => onRemoveBlocker?.(entry),
			testId: 'calendar-entry-remove'
		});
	if (actions.length === 0)
		actions.push({ label: t('app.close'), onClick: onClose });

	const kindLine =
		entry.type === 'appointment' && entry.kind
			? t(`calendar.kinds.${entry.kind}`)
			: entry.type === 'group'
				? t('calendar.types.group')
				: undefined;

	return (
		<M3Dialog
			open
			data-testid="calendar-entry-dialog"
			icon={<CalendarEntryGlyph entry={entry} colleague={colleague} />}
			title={label(entry, colleague)}
			description={format(entry.start, entry.end)}
			width={400}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={actions.slice(-2)}
		>
			<dl className="calendarDetails">
				{kindLine && (
					<>
						<dt>{t('calendar.dialog.kind')}</dt>
						<dd>{kindLine}</dd>
					</>
				)}
				{colleague && colleagueName && (
					<>
						<dt>{t('calendar.calendars')}</dt>
						<dd>
							{t('calendar.details.colleague', {
								name: colleagueName
							})}
						</dd>
					</>
				)}
				{!colleague && entry.kind === 'onsite' && entry.address && (
					<>
						<dt>{t('calendar.details.address')}</dt>
						<dd>{entry.address}</dd>
					</>
				)}
			</dl>
			{(colleague || entry.type === 'busy') && (
				<p className="calendarDetails__hint">
					{t(
						entry.type === 'busy'
							? 'calendar.details.busyHint'
							: 'calendar.details.colleagueHint'
					)}
				</p>
			)}
		</M3Dialog>
	);
};
