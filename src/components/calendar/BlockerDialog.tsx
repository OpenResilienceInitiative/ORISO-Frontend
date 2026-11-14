/**
 * Enter blocked time ("Sperrzeit"): one range, the whole day, or the same
 * time on chosen weekdays up to a last day — "immer montags, fortlaufend"
 * (Frank, 2026-11-14). Colleagues only ever see "Sperrzeit".
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTextField } from '../form/OrisoTextField';
import { FilterChip } from '../displayFilter/FilterChip';
import { Switch } from '../Switch';
import {
	daySpan,
	expandBlocker,
	findConflicts,
	isWholeDays,
	MAX_BLOCKER_OCCURRENCES,
	type AppointmentDraft,
	type CalendarEntry
} from './calendarModel';
import { FacetIcon } from './CalendarEntryGlyph';
import { useDayLabels } from './useEntryLabel';
import { calendarLocale } from './calendarLocale';

/** Monday first, JavaScript weekday numbers. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** A cleared time field gives no range, never midnight. */
const join = (day: Dayjs, time: Dayjs | null) =>
	time
		? day.hour(time.hour()).minute(time.minute()).second(0).millisecond(0)
		: null;

export interface BlockerDialogProps {
	open: boolean;
	/** Preset from a selected slot. */
	slot?: { start: Date; end: Date };
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	fullScreen?: boolean;
	onSave: (drafts: AppointmentDraft[]) => void;
	onClose: () => void;
}

export const BlockerDialog = ({
	open,
	slot,
	entries,
	ownerId,
	now,
	fullScreen,
	onSave,
	onClose
}: BlockerDialogProps) => {
	const dayLabels = useDayLabels();
	const { t, i18n } = useTranslation();
	// A month selection covers whole days (exclusive midnight end); a timed
	// slot may end on a later day. Both keep their date span.
	const wholeDays = !!slot && isWholeDays(slot);
	const first = slot
		? dayjs(slot.start)
		: dayjs(now).add(1, 'day').hour(8).minute(0);
	const span = slot
		? daySpan(slot.start, slot.end) - (wholeDays ? 1 : 0)
		: 0;
	const [day, setDay] = useState<Dayjs | null>(first.startOf('day'));
	const [start, setStart] = useState<Dayjs | null>(
		wholeDays ? first.hour(8) : first
	);
	const [end, setEnd] = useState<Dayjs | null>(
		wholeDays
			? first.hour(12)
			: slot
				? dayjs(slot.end)
				: first.add(4, 'hour')
	);
	const [allDay, setAllDay] = useState(wholeDays);
	const [weekdays, setWeekdays] = useState<number[]>([]);
	const [until, setUntil] = useState<Dayjs | null>(first.add(4, 'week'));
	const [note, setNote] = useState('');

	const weekdayName = (weekday: number) =>
		new Intl.DateTimeFormat(calendarLocale(i18n.language), {
			weekday: 'short'
		}).format(new Date(2026, 10, 15 + weekday));

	// One more than the bound, so a series the bound would cut is noticed.
	const expanded = useMemo(() => {
		if (!day) return [];
		const lastDay = day.add(span, 'day');
		const s = allDay ? day.startOf('day') : join(day, start);
		const e = allDay ? lastDay.endOf('day') : join(lastDay, end);
		if (!s || !e || !e.isAfter(s)) return [];
		// Chosen weekdays without a last day are not a single blocker.
		if (weekdays.length && !until) return [];
		return expandBlocker(
			{ start: s.toDate(), end: e.toDate() },
			weekdays.length && until
				? { weekdays, until: until.toDate() }
				: undefined,
			MAX_BLOCKER_OCCURRENCES + 1
		);
	}, [day, span, start, end, allDay, weekdays, until]);
	const tooMany = expanded.length > MAX_BLOCKER_OCCURRENCES;
	const ranges = tooMany ? [] : expanded;

	const conflicts = ranges.flatMap((r) =>
		findConflicts(r, entries, ownerId).filter((e) => e.type !== 'blocker')
	);
	// A whole day counts by its date, so today stays possible after 00:00.
	const invalid =
		ranges.length === 0 ||
		(allDay
			? ranges[0].end.getTime() <= now.getTime()
			: ranges[0].start.getTime() < now.getTime());

	const toggleWeekday = (weekday: number) =>
		setWeekdays((all) =>
			all.includes(weekday)
				? all.filter((d) => d !== weekday)
				: [...all, weekday]
		);

	return (
		<M3Dialog
			open={open}
			data-testid="calendar-blocker-dialog"
			title={t('calendar.blocker.title')}
			description={t('calendar.blocker.description')}
			icon={<FacetIcon facet="blocker" />}
			width={680}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t('calendar.blocker.save'),
					primary: true,
					disabled: invalid,
					testId: 'calendar-blocker-save',
					onClick: () =>
						onSave(
							ranges.map((r) => ({
								type: 'blocker',
								start: r.start,
								end: r.end,
								allDay,
								note: note || undefined
							}))
						)
				}
			]}
		>
			<div className="calendarDialog calendarDialog--withMonth">
				<div className="calendarDialog__month">
					<OrisoCalendar
						value={day}
						onChange={setDay}
						minDate={dayjs(now).startOf('day')}
						weekStart={1}
						dayLabels={dayLabels}
						disableContainer
					/>
				</div>
				<div className="calendarDialog__fields">
					<Switch
						checked={allDay}
						onChange={setAllDay}
						titleKey="calendar.blocker.allDay"
						data-cy="calendar-blocker-all-day"
					/>
					{!allDay && (
						<div className="calendarDialog__times">
							<OrisoTimePicker
								label={t('calendar.dialog.start')}
								ampm={false}
								value={start}
								onChange={setStart}
								cancelLabel={t('app.cancel')}
							/>
							<OrisoTimePicker
								label={t('calendar.dialog.end')}
								ampm={false}
								value={end}
								onChange={setEnd}
								cancelLabel={t('app.cancel')}
							/>
						</div>
					)}
					<div
						className="calendarDialog__group"
						role="group"
						aria-label={t('calendar.blocker.repeat')}
					>
						<span className="calendarDialog__label">
							{t('calendar.blocker.repeat')}
						</span>
						<div className="calendarDialog__weekdays">
							{WEEKDAYS.map((weekday) => (
								<FilterChip
									key={weekday}
									view="text"
									label={weekdayName(weekday)}
									active={weekdays.includes(weekday)}
									onClick={() => toggleWeekday(weekday)}
									data-cy={`calendar-weekday-${weekday}`}
								/>
							))}
						</div>
					</div>
					{weekdays.length > 0 && (
						<OrisoDatePicker
							label={t('calendar.blocker.until')}
							value={until}
							onChange={setUntil}
							minDate={day ?? undefined}
							weekStart={1}
						/>
					)}
					<OrisoTextField
						label={t('calendar.dialog.note')}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						fullWidth
					/>
					<p className="calendarDialog__summary" role="status">
						{tooMany
							? t('calendar.blocker.tooMany', {
									max: MAX_BLOCKER_OCCURRENCES
								})
							: t('calendar.blocker.count', {
									count: ranges.length
								})}
						{conflicts.length > 0 &&
							` ${t('calendar.blocker.conflicts', { count: conflicts.length })}`}
					</p>
				</div>
			</div>
		</M3Dialog>
	);
};
