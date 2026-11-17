/**
 * "Abwesenheit" in "Neuer Eintrag" (ORISO-Frontend#2303): a planned absence
 * over whole days. It is the same absence as in the profile: saving it
 * switches the absence on for these days, with the message advice seekers
 * see. Appointments inside the range are listed, never cancelled (Frank,
 * 2026-11-17).
 */
import * as React from 'react';
import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTextField } from '../form/OrisoTextField';
import { findConflicts, type CalendarEntry } from './calendarModel';
import type { DialogForm } from './dialogForm';
import { calendarLocale } from './calendarLocale';

/** A planned absence as the profile stores it: first and last day, inclusive. */
export interface AbsenceDraft {
	/** YYYY-MM-DD */
	start: string;
	/** YYYY-MM-DD */
	end: string;
	message: string;
}

export interface AbsenceFormProps {
	/** Preset: the first day of a selected slot. */
	slot?: { start: Date; end: Date };
	/** The absence the profile holds already. */
	initialAbsence?: Partial<AbsenceDraft>;
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	onSave: (draft: AbsenceDraft) => void;
	onClose: () => void;
}

const DAY = 'YYYY-MM-DD';

export const useAbsenceForm = ({
	slot,
	initialAbsence,
	entries,
	ownerId,
	now,
	onSave,
	onClose
}: AbsenceFormProps): DialogForm => {
	const { t, i18n } = useTranslation();
	const firstDay = initialAbsence?.start
		? dayjs(initialAbsence.start, DAY)
		: dayjs(slot?.start ?? dayjs(now).add(1, 'day').toDate()).startOf(
				'day'
			);
	const [from, setFrom] = useState<Dayjs | null>(firstDay);
	const [until, setUntil] = useState<Dayjs | null>(
		initialAbsence?.end
			? dayjs(initialAbsence.end, DAY)
			: firstDay.add(6, 'day')
	);
	const [message, setMessage] = useState(initialAbsence?.message ?? '');

	const today = dayjs(now).startOf('day');
	const invalid =
		!from ||
		!until ||
		until.isBefore(from, 'day') ||
		until.isBefore(today, 'day');

	// Own appointments inside the range: a warning, not a cancellation.
	const conflicts = invalid
		? []
		: findConflicts(
				{
					start: from.startOf('day').toDate(),
					end: until.add(1, 'day').startOf('day').toDate()
				},
				entries,
				ownerId
			).filter((entry) => entry.type === 'appointment');

	const format = (iso: string) =>
		new Intl.DateTimeFormat(calendarLocale(i18n.language), {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));

	return {
		testId: 'calendar-absence-dialog',
		description: t('calendar.absence.description'),
		icon: <EventBusyOutlinedIcon aria-hidden="true" focusable="false" />,
		width: 680,
		actions: [
			{ label: t('app.cancel'), onClick: onClose },
			{
				label: t(
					conflicts.length
						? 'calendar.dialog.saveAnyway'
						: 'calendar.absence.save'
				),
				primary: true,
				disabled: invalid,
				testId: 'calendar-absence-save',
				onClick: () =>
					!invalid &&
					onSave({
						start: from.format(DAY),
						end: until.format(DAY),
						message
					})
			}
		],
		content: (
			<div className="calendarDialog calendarAbsence">
				<div className="calendarDialog__fields">
					<div className="calendarDialog__times">
						<OrisoDatePicker
							label={t('calendar.absence.from')}
							value={from}
							onChange={setFrom}
							minDate={today}
							weekStart={1}
						/>
						<OrisoDatePicker
							label={t('calendar.absence.until')}
							value={until}
							onChange={setUntil}
							minDate={from ?? today}
							weekStart={1}
						/>
					</div>
					<OrisoTextField
						label={t('calendar.absence.message')}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						helperText={t('calendar.absence.messageHint')}
						multiline
						minRows={2}
						fullWidth
					/>
					<p className="calendarDialog__summary">
						{t('calendar.absence.effect')}
					</p>
					{conflicts.length > 0 && (
						<div
							className="calendarAbsence__conflicts"
							role="status"
							data-testid="calendar-absence-conflicts"
						>
							<p>
								{t('calendar.absence.conflicts', {
									count: conflicts.length
								})}
							</p>
							<ul>
								{conflicts.map((entry) => (
									<li key={entry.id}>
										{format(entry.start)}
										{entry.title ? ` · ${entry.title}` : ''}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
		)
	};
};
