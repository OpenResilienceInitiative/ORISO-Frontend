/**
 * "Arbeitszeit festlegen" (ADR-032, UserService#1649, contract v1.2): hours
 * per weekday, each with its own pause (Frank, prototype v15; on by default,
 * stored as the gap between the day's two windows)
 * and "Feiertage frei" with the Bundesland whose public holidays are days
 * off. Outside the hours the calendar is shaded and the free-time search
 * does not look; booking ignores them.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import { OrisoSelect } from '../form/OrisoSelect';
import {
	HOLIDAY_REGIONS,
	isHolidayRegion,
	nextHoliday,
	type HolidayRegion
} from './calendarHolidays';
import {
	dialogWorkingHours,
	exceedsWindowLimit,
	groupWorkingHours,
	invalidPauses,
	invalidRows,
	type DayPause,
	workingHoursToRows,
	type WorkingDayRow,
	type WorkingHours,
	MAX_WORKING_HOURS_WINDOWS
} from './calendarWorkingHours';
import { calendarLocale } from './calendarLocale';

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
	const locale = calendarLocale(i18n.language);
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
	const [holidays, setHolidays] = useState(!!holidayRegion);
	const [region, setRegion] = useState<HolidayRegion | ''>(
		holidayRegion ?? ''
	);
	const invalid = invalidRows(rows);
	const wrongPauses = invalidPauses(rows);
	const breakInvalid = wrongPauses.length > 0;
	const regionMissing = holidays && !region;
	const next = dialogWorkingHours(hours, rows);
	// Over UserService's limit: refuse it here, before the dialog closes
	// (review 4575297370).
	const tooMany = exceedsWindowLimit(next);
	const upcoming =
		holidays && region ? nextHoliday(now ?? new Date(), region) : undefined;
	const locale = calendarLocale(i18n.language);
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
	const updatePause = (weekday: number, patch: Partial<DayPause>) =>
		setRows((all) =>
			all.map((r) =>
				r.weekday === weekday
					? { ...r, pause: { ...r.pause, ...patch } }
					: r
			)
		);
	// One set of hours for the week: Monday's times and pause on every
	// working day (prototype v17).
	const monday = rows.find((r) => r.weekday === 1);
	const copyMonday = () =>
		monday &&
		setRows((all) =>
			all.map((r) =>
				r.enabled && r.weekday !== 1
					? {
							...r,
							start: monday.start,
							end: monday.end,
							pause: { ...monday.pause }
						}
					: r
			)
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
					disabled:
						invalid.length > 0 ||
						breakInvalid ||
						regionMissing ||
						tooMany,
					onClick: () =>
						onSave(next, holidays && region ? region : null),
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
					const pauseWrong = wrongPauses.includes(row.weekday);
					const pauseOn = row.enabled && row.pause.enabled;
					return (
						<React.Fragment key={row.weekday}>
							<div
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
								<span className="calendarHours__day">
									{name}
								</span>
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
							{/* Each day its own pause, or none (Frank, prototype v15). */}
							<div
								className={`calendarHours__row calendarHours__row--pause${pauseOn ? '' : ' calendarHours__row--off'}`}
								data-cy={`calendar-hours-pause-${row.weekday}`}
							>
								<label className="calendarHours__pauseOn">
									<input
										type="checkbox"
										checked={row.pause.enabled}
										disabled={!row.enabled}
										aria-label={t(
											'calendar.workingHours.breakOn',
											{
												day: name
											}
										)}
										onChange={(e) =>
											updatePause(row.weekday, {
												enabled: e.target.checked
											})
										}
									/>
									<span aria-hidden="true">
										{t('calendar.workingHours.break')}
									</span>
								</label>
								<label className="calendarHours__time">
									<span className="sr-only">
										{t('calendar.workingHours.breakFrom', {
											day: name
										})}
									</span>
									<input
										type="time"
										step={900}
										value={row.pause.start}
										disabled={!pauseOn}
										aria-invalid={pauseWrong || undefined}
										onChange={(e) =>
											updatePause(row.weekday, {
												start: e.target.value
											})
										}
									/>
								</label>
								<span aria-hidden="true">–</span>
								<label className="calendarHours__time">
									<span className="sr-only">
										{t('calendar.workingHours.breakTo', {
											day: name
										})}
									</span>
									<input
										type="time"
										step={900}
										value={row.pause.end}
										disabled={!pauseOn}
										aria-invalid={pauseWrong || undefined}
										onChange={(e) =>
											updatePause(row.weekday, {
												end: e.target.value
											})
										}
									/>
								</label>
							</div>
						</React.Fragment>
					);
				})}
				<button
					type="button"
					className="calendarHours__copy"
					disabled={!monday?.enabled}
					onClick={copyMonday}
					data-cy="calendar-hours-copy-monday"
				>
					{t('calendar.workingHours.copyMonday')}
				</button>
				{/* Holidays and the Bundesland in one box under the days
				    (Frank *10: more air, the region choice stands out). */}
				<div className="calendarHours__holidayBox">
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
							<small>
								{t('calendar.workingHours.holidaysHint')}
							</small>
						</span>
					</div>
					{holidays && (
						<div className="calendarHours__region">
							{/* The MUI 3 select of the design system, not an own
							    field (Frank *12). */}
							<div className="calendarHours__select">
								<OrisoSelect
									label={t('calendar.holidays.region')}
									value={region}
									error={regionMissing}
									aria-describedby="calendar-hours-next-holiday"
									options={HOLIDAY_REGIONS.map((code) => ({
										value: code,
										label: t(
											`calendar.holidays.regions.${code}`
										)
									}))}
									onChange={(event) =>
										setRegion(
											isHolidayRegion(event.target.value)
												? event.target.value
												: ''
										)
									}
									data-cy="calendar-hours-region"
								/>
							</div>
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
				</div>
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
				{tooMany && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.workingHours.tooMany', {
							max: MAX_WORKING_HOURS_WINDOWS
						})}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
