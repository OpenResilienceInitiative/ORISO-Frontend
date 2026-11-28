/**
 * "Abwesenheit" in "Neuer Eintrag" (ORISO-Frontend#2303, #2500): the absence
 * of the profile. It is either dated (first to last day, inclusive) or
 * without dates: then it runs one week at a time, Monday to Monday, and
 * extends itself every Monday until the counsellor ends it (#2500).
 *
 * #2500: appointments inside the absence are cancelled and the counsellor is
 * taken off Gesprächskreise. The form says so before saving and counts what
 * is affected. The cancelling itself is the backend's job (UserService);
 * this form only shows it.
 */
import * as React from 'react';
import { useId, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FormControlLabel, Radio, RadioGroup } from '@mui/material';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTextField } from '../form/OrisoTextField';
import { findConflicts, type CalendarEntry } from './calendarModel';
import type { DialogForm } from './dialogForm';
import { calendarLocale } from './calendarLocale';

/** Dated (first to last day) or without dates, extending weekly (#2500). */
export type AbsenceKind = 'dated' | 'weekly';

/** An absence as the profile stores it. */
export interface AbsenceDraft {
	kind: AbsenceKind;
	/** YYYY-MM-DD, first day. */
	start: string;
	/** YYYY-MM-DD, last day, inclusive. Only for a dated absence. */
	end?: string;
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

/** The Monday after `day` (a Monday gives the Monday a week later). */
export const nextMonday = (day: Dayjs): Dayjs => {
	const weekday = day.day(); // 0 = Sunday … 6 = Saturday
	return day.startOf('day').add((8 - weekday) % 7 || 7, 'day');
};

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
	const kindName = useId();
	const firstDay = initialAbsence?.start
		? dayjs(initialAbsence.start, DAY)
		: dayjs(slot?.start ?? dayjs(now).add(1, 'day').toDate()).startOf(
				'day'
			);
	const [kind, setKind] = useState<AbsenceKind>(
		initialAbsence?.kind ?? 'dated'
	);
	const [from, setFrom] = useState<Dayjs | null>(firstDay);
	const [until, setUntil] = useState<Dayjs | null>(
		initialAbsence?.end
			? dayjs(initialAbsence.end, DAY)
			: firstDay.add(6, 'day')
	);
	const [message, setMessage] = useState(initialAbsence?.message ?? '');

	const today = dayjs(now).startOf('day');
	const weekly = kind === 'weekly';
	const weekEnd = nextMonday(today);
	const dated =
		!weekly &&
		from &&
		until &&
		!until.isBefore(from, 'day') &&
		!until.isBefore(today, 'day')
			? { from, until }
			: null;
	const invalid = !weekly && !dated;

	// What the absence covers now: the dated range, or this week up to Monday.
	const range = weekly
		? { start: today.toDate(), end: weekEnd.toDate() }
		: dated
			? {
					start: dated.from.startOf('day').toDate(),
					end: dated.until.add(1, 'day').startOf('day').toDate()
				}
			: null;
	const affected = range
		? findConflicts(range, entries, ownerId).filter(
				(entry) =>
					entry.type === 'appointment' || entry.type === 'group'
			)
		: [];
	const appointments = affected.filter(
		(entry) => entry.type === 'appointment'
	).length;
	const circles = affected.length - appointments;

	const formatDay = (day: Dayjs) =>
		new Intl.DateTimeFormat(calendarLocale(i18n.language), {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(day.toDate());
	const format = (iso: string) =>
		new Intl.DateTimeFormat(calendarLocale(i18n.language), {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));

	const save = () => {
		if (weekly) onSave({ kind, start: today.format(DAY), message });
		else if (dated)
			onSave({
				kind,
				start: dated.from.format(DAY),
				end: dated.until.format(DAY),
				message
			});
	};

	return {
		testId: 'calendar-absence-dialog',
		description: t('calendar.absence.description'),
		icon: <EventBusyOutlinedIcon aria-hidden="true" focusable="false" />,
		width: 680,
		actions: [
			{ label: t('app.cancel'), onClick: onClose },
			{
				label: t(
					affected.length
						? 'calendar.absence.saveAndCancel'
						: 'calendar.absence.save'
				),
				primary: true,
				disabled: invalid,
				testId: 'calendar-absence-save',
				onClick: save
			}
		],
		content: (
			<div className="calendarDialog calendarAbsence">
				<div className="calendarDialog__fields">
					<RadioGroup
						name={kindName}
						aria-label={t('calendar.absence.kind.label')}
						className="calendarAbsence__kinds"
						value={kind}
						onChange={(event) =>
							setKind(
								event.target.value === 'weekly'
									? 'weekly'
									: 'dated'
							)
						}
					>
						<FormControlLabel
							value="dated"
							control={<Radio />}
							data-testid="calendar-absence-kind-dated"
							label={
								<span className="calendarAbsence__kindText">
									<span>
										{t('calendar.absence.kind.dated')}
									</span>
									<span className="calendarAbsence__kindHint">
										{t('calendar.absence.kind.datedHint')}
									</span>
								</span>
							}
						/>
						<FormControlLabel
							value="weekly"
							control={<Radio />}
							data-testid="calendar-absence-kind-weekly"
							label={
								<span className="calendarAbsence__kindText">
									<span>
										{t('calendar.absence.kind.weekly')}
									</span>
									<span className="calendarAbsence__kindHint">
										{t('calendar.absence.kind.weeklyHint', {
											date: formatDay(weekEnd)
										})}
									</span>
								</span>
							}
						/>
					</RadioGroup>
					{!weekly && (
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
					)}
					<OrisoTextField
						label={t('calendar.absence.message')}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						helperText={t('calendar.absence.messageHint')}
						multiline
						minRows={2}
						fullWidth
					/>
					{range && (
						<div
							className="calendarAbsence__conflicts"
							role="status"
							data-testid="calendar-absence-warning"
						>
							<p className="calendarAbsence__warningTitle">
								{t('calendar.absence.warning.title')}
							</p>
							<ul>
								<li>{t('calendar.absence.warning.cancel')}</li>
								<li>{t('calendar.absence.warning.circles')}</li>
								<li>{t('calendar.absence.warning.notify')}</li>
								{weekly && (
									<li>
										{t('calendar.absence.warning.weekly')}
									</li>
								)}
							</ul>
							{affected.length > 0 ? (
								<div data-testid="calendar-absence-conflicts">
									<p>
										{t('calendar.absence.affected', {
											appointments: t(
												'calendar.absence.affectedAppointments',
												{ count: appointments }
											),
											circles: t(
												'calendar.absence.affectedCircles',
												{ count: circles }
											)
										})}
									</p>
									<ul>
										{affected.map((entry) => (
											<li key={entry.id}>
												{format(entry.start)}
												{entry.title
													? ` · ${entry.title}`
													: ''}
											</li>
										))}
									</ul>
								</div>
							) : (
								<p>{t('calendar.absence.noneAffected')}</p>
							)}
						</div>
					)}
					{!weekly && (
						<p className="calendarDialog__summary">
							{t('calendar.absence.effect')}
						</p>
					)}
				</div>
			</div>
		)
	};
};
