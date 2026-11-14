/**
 * "Arbeitszeit festlegen" (ADR-032, UserService#1649, contract v1.2): hours
 * per weekday, a lunch break (on by default, stored as two windows a day)
 * and "Feiertage frei" with the Bundesland whose public holidays are days
 * off. Outside the hours the calendar is shaded and the free-time search
 * does not look; booking ignores them.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import {
	HOLIDAY_REGIONS,
	isHolidayRegion,
	nextHoliday,
	type HolidayRegion
} from './calendarHolidays';
import {
	breakOf,
	groupWorkingHours,
	invalidRows,
	isBreakValid,
	type DayBreak,
	rowsToWorkingHours,
	workingHoursToRows,
	type WorkingDayRow,
	type WorkingHours
} from './calendarWorkingHours';

export interface WorkingHoursDialogProps {
	open: boolean;
	hours: WorkingHours;
	fullScreen?: boolean;
	/** Bundesland whose public holidays are days off; null = none. */
	holidayRegion?: HolidayRegion | null;
	/** For "Nächster Feiertag: …"; today by default. */
	now?: Date;
	onSave: (hours: WorkingHours, holidayRegion: HolidayRegion | null) => void;
	onClose: () => void;
}

/** Long weekday names in the reader's language, by JavaScript weekday. */
export const useWeekdayNames = (style: 'long' | 'short' = 'long') => {
	const { i18n } = useTranslation();
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const format = new Intl.DateTimeFormat(locale, { weekday: style });
	// 15 November 2026 is a Sunday.
	return (weekday: number) =>
		format.format(new Date(2026, 10, 15 + weekday)).replace(/\.$/, '');
};

/** "Mo–Fr 08:00–18:00, Sa 10:00–12:00", or undefined when none is set. */
export const useWorkingHoursSummary = () => {
	const dayName = useWeekdayNames('short');
	return (hours: WorkingHours) => {
		const groups = groupWorkingHours(hours);
		if (groups.length === 0) return undefined;
		return groups
			.map((g) => {
				const days =
					g.contiguous && g.weekdays.length > 2
						? `${dayName(g.weekdays[0])}–${dayName(g.weekdays[g.weekdays.length - 1])}`
						: g.weekdays.map(dayName).join(', ');
				return `${days} ${g.start}–${g.end}`;
			})
			.join(' · ');
	};
};

export const WorkingHoursDialog = ({
	open,
	hours,
	fullScreen,
	holidayRegion = null,
	now,
	onSave,
	onClose
}: WorkingHoursDialogProps) => {
	const { t, i18n } = useTranslation();
	const dayName = useWeekdayNames();
	const [rows, setRows] = useState<WorkingDayRow[]>(() =>
		workingHoursToRows(hours)
	);
	const [dayBreak, setDayBreak] = useState<DayBreak>(() => breakOf(hours));
	const [holidays, setHolidays] = useState(!!holidayRegion);
	const [region, setRegion] = useState<HolidayRegion | ''>(
		holidayRegion ?? ''
	);
	const invalid = invalidRows(rows);
	const breakInvalid = !isBreakValid(dayBreak);
	const regionMissing = holidays && !region;
	const upcoming =
		holidays && region ? nextHoliday(now ?? new Date(), region) : undefined;
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const upcomingText = upcoming
		? t('calendar.holidays.next', {
				name: t(`calendar.holidays.names.${upcoming.key}`, {
					defaultValue: upcoming.name
				}),
				date: new Intl.DateTimeFormat(locale, {
					weekday: 'short',
					day: 'numeric',
					month: 'numeric',
					year: 'numeric'
				}).format(new Date(`${upcoming.date}T12:00:00`))
			})
		: undefined;
	const update = (weekday: number, patch: Partial<WorkingDayRow>) =>
		setRows((all) =>
			all.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r))
		);

	return (
		<M3Dialog
			open={open}
			title={t('calendar.workingHours.title')}
			description={t('calendar.workingHours.description')}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			data-testid="calendar-working-hours-dialog"
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t('calendar.workingHours.save'),
					primary: true,
					disabled: invalid.length > 0 || breakInvalid || regionMissing,
					onClick: () =>
						onSave(
							rowsToWorkingHours(rows, dayBreak),
							holidays && region ? region : null
						),
					testId: 'calendar-working-hours-save'
				}
			]}
		>
			<div
				className="calendarHours"
				role="group"
				aria-label={t('calendar.workingHours.title')}
			>
				{rows.map((row) => {
					const name = dayName(row.weekday);
					const wrong = invalid.includes(row.weekday);
					return (
						<div
							key={row.weekday}
							className={`calendarHours__row${row.enabled ? '' : ' calendarHours__row--off'}`}
							data-cy={`calendar-hours-${row.weekday}`}
						>
							<Switch
								checked={row.enabled}
								onChange={(enabled) =>
									update(row.weekday, { enabled })
								}
								aria-label={name}
								showIcon={false}
							/>
							<span className="calendarHours__day">{name}</span>
							<label className="calendarHours__time">
								<span className="sr-only">
									{t('calendar.workingHours.from', {
										day: name
									})}
								</span>
								<input
									type="time"
									step={900}
									value={row.start}
									disabled={!row.enabled}
									aria-invalid={wrong || undefined}
									onChange={(e) =>
										update(row.weekday, {
											start: e.target.value
										})
									}
								/>
							</label>
							<span aria-hidden="true">–</span>
							<label className="calendarHours__time">
								<span className="sr-only">
									{t('calendar.workingHours.to', {
										day: name
									})}
								</span>
								<input
									type="time"
									step={900}
									value={row.end}
									disabled={!row.enabled}
									aria-invalid={wrong || undefined}
									onChange={(e) =>
										update(row.weekday, {
											end: e.target.value
										})
									}
								/>
							</label>
						</div>
					);
				})}
				<div
					className={`calendarHours__row calendarHours__row--break${dayBreak.enabled ? '' : ' calendarHours__row--off'}`}
					data-cy="calendar-hours-break"
				>
					<Switch
						checked={dayBreak.enabled}
						onChange={(enabled) =>
							setDayBreak((b) => ({ ...b, enabled }))
						}
						aria-label={t('calendar.workingHours.break')}
						showIcon={false}
					/>
					<span className="calendarHours__day">
						{t('calendar.workingHours.break')}
					</span>
					<label className="calendarHours__time">
						<span className="sr-only">
							{t('calendar.workingHours.breakFrom')}
						</span>
						<input
							type="time"
							step={900}
							value={dayBreak.start}
							disabled={!dayBreak.enabled}
							aria-invalid={breakInvalid || undefined}
							onChange={(e) =>
								setDayBreak((b) => ({
									...b,
									start: e.target.value
								}))
							}
						/>
					</label>
					<span aria-hidden="true">–</span>
					<label className="calendarHours__time">
						<span className="sr-only">
							{t('calendar.workingHours.breakTo')}
						</span>
						<input
							type="time"
							step={900}
							value={dayBreak.end}
							disabled={!dayBreak.enabled}
							aria-invalid={breakInvalid || undefined}
							onChange={(e) =>
								setDayBreak((b) => ({
									...b,
									end: e.target.value
								}))
							}
						/>
					</label>
				</div>
				<div
					className="calendarHours__row calendarHours__row--holidays"
					data-cy="calendar-hours-holidays"
				>
					<Switch
						checked={holidays}
						onChange={setHolidays}
						aria-label={t('calendar.workingHours.holidays')}
						showIcon={false}
					/>
					<span className="calendarHours__holidays">
						{t('calendar.workingHours.holidays')}
						<small>{t('calendar.workingHours.holidaysHint')}</small>
					</span>
				</div>
				{holidays && (
					<div className="calendarHours__region">
						<label className="calendarHours__time calendarHours__select">
							<span>{t('calendar.holidays.region')}</span>
							<select
								value={region}
								aria-invalid={regionMissing || undefined}
								aria-describedby="calendar-hours-next-holiday"
								onChange={(e) =>
									setRegion(
										isHolidayRegion(e.target.value)
											? e.target.value
											: ''
									)
								}
								data-cy="calendar-hours-region"
							>
								<option value="" disabled>
									{t('calendar.holidays.choose')}
								</option>
								{HOLIDAY_REGIONS.map((code) => (
									<option key={code} value={code}>
										{t(`calendar.holidays.regions.${code}`)}
									</option>
								))}
							</select>
						</label>
						<p
							id="calendar-hours-next-holiday"
							className="calendarHours__next"
							aria-live="polite"
							data-cy="calendar-hours-next-holiday"
						>
							{regionMissing
								? t('calendar.holidays.chooseHint')
								: upcomingText}
						</p>
					</div>
				)}
				{invalid.length > 0 && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.workingHours.invalid')}
					</p>
				)}
				{breakInvalid && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.workingHours.breakInvalid')}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
