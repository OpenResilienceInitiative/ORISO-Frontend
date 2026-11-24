/**
 * "Sprechstunden" (ORISO-Frontend#2287): the weekly times advice seekers can
 * book themselves, separate from the working hours, plus how a booking is
 * accepted. Outside the notice period a booking is confirmed at once when
 * "Automatisch bestätigen" is on; otherwise it is a request the counsellor
 * confirms. Only the counsellor edits their own; UserService checks again.
 *
 * FE#2494 *2b (Frank, 23 Nov 2026): a day takes as many windows as "+"
 * adds, and a Sprechzeit can also be released once, at short notice, from
 * the calendar ("Einmalig"), bookable until a lead time of its own.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { ReactComponent as ClockIcon } from '../../resources/img/icons/clock.svg';
import { ReactComponent as PlusIcon } from '../../resources/img/icons/plus.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import type { DialogForm } from './dialogForm';
import { onRovingRadioKey } from './rovingRadio';
import { Switch } from '../Switch';
import { OrisoSelect } from '../form/OrisoSelect';
import { OrisoDatePicker } from '../form/OrisoDatePicker';
import { OrisoTimePicker } from '../form/OrisoTimePicker';
import { useWeekdayNames } from './WorkingHoursDialog';
import {
	consultationDays,
	consultationHoursToApi,
	DEFAULT_ONE_OFF_NOTICE,
	invalidConsultationDays,
	nextConsultationWindow,
	ONE_OFF_NOTICE_MINUTES,
	overlappingConsultationDays,
	MAX_NOTICE_DAYS,
	type ConsultationDay,
	type ConsultationHours,
	type ConsultationWindow,
	type OneOffConsultation,
	type SlotMinutes
} from './calendarConsultationHours';
import type { CalendarEntry } from './calendarModel';

export interface ConsultationHoursDialogProps {
	open: boolean;
	hours: ConsultationHours;
	fullScreen?: boolean;
	/** A save is on its way: the dialog holds a second one back. */
	saving?: boolean;
	onSave: (hours: ConsultationHours) => void;
	onClose: () => void;
}

const SLOT_MINUTES: SlotMinutes[] = [30, 60];
const NOTICE_DAYS = Array.from({ length: MAX_NOTICE_DAYS + 1 }, (_, n) => n);

type Mode = 'once' | 'weekly';
const MODES: Mode[] = ['once', 'weekly'];

/** The chosen day at the chosen clock time; an unset field gives an invalid date. */
const onTheDay = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day
				.hour(time.hour())
				.minute(time.minute())
				.second(0)
				.millisecond(0)
				.toDate()
		: new Date(Number.NaN);

export interface ConsultationHoursFormProps {
	hours: ConsultationHours;
	saving?: boolean;
	onSave: (hours: ConsultationHours) => void;
	/**
	 * Saves a one-off Sprechzeit; without it the form has no "Einmalig"
	 * (FE#2494 *2b).
	 */
	onSaveOneOff?: (oneOff: OneOffConsultation) => void;
	/** The range chosen in the calendar: the form opens on "Einmalig". */
	slot?: { start: Date; end: Date };
	/** One's entries, to say when a one-off lies over a Sperrzeit. */
	entries?: CalendarEntry[];
	/**
	 * The interval the last save was refused for, over a Sperrzeit outside
	 * the loaded entries: for that same interval the form says so, and
	 * saving again releases over it.
	 */
	blockerConflict?: { start: Date; end: Date };
	now?: Date;
	onClose: () => void;
}

/**
 * The Sprechstunden form without its frame: the dialog below and the tab
 * "Sprechzeit" in "Neuer Eintrag" (FE#2494 *2b) show the same form and save
 * the same office hours.
 */
export const useConsultationHoursForm = ({
	hours,
	saving = false,
	onSave,
	onSaveOneOff,
	slot,
	entries = [],
	blockerConflict,
	now = new Date(),
	onClose
}: ConsultationHoursFormProps): DialogForm => {
	const { t } = useTranslation();
	const dayName = useWeekdayNames();
	const [mode, setMode] = useState<Mode>(
		slot && onSaveOneOff ? 'once' : 'weekly'
	);
	const shown: Mode = onSaveOneOff ? mode : 'weekly';
	const [days, setDays] = useState<ConsultationDay[]>(() =>
		consultationDays(hours.windows)
	);
	const [autoAccept, setAutoAccept] = useState(hours.autoAccept);
	const [noticeDays, setNoticeDays] = useState(hours.noticeDays);
	const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(
		hours.slotMinutes
	);
	/* Einmalig: the chosen range, or the next full hour for one hour. */
	const [once, setOnce] = useState(() => {
		const start = dayjs(slot?.start ?? now)
			.add(slot ? 0 : 1, 'hour')
			.minute(slot ? dayjs(slot.start).minute() : 0)
			.second(0)
			.millisecond(0);
		const end = slot ? dayjs(slot.end) : start.add(1, 'hour');
		return {
			day: start.startOf('day') as Dayjs | null,
			start: start as Dayjs | null,
			end: end as Dayjs | null,
			notice: DEFAULT_ONE_OFF_NOTICE
		};
	});
	/* The saved hours may arrive after the dialog opened: an untouched
	   draft takes them, an edited one stays the user's (FE#2494 review). */
	const shownHours = useRef(hours);
	useEffect(() => {
		const before = shownHours.current;
		shownHours.current = hours;
		if (before === hours) return;
		const untouched =
			JSON.stringify(days) ===
				JSON.stringify(consultationDays(before.windows)) &&
			autoAccept === before.autoAccept &&
			noticeDays === before.noticeDays &&
			slotMinutes === before.slotMinutes;
		if (!untouched) return;
		setDays(consultationDays(hours.windows));
		setAutoAccept(hours.autoAccept);
		setNoticeDays(hours.noticeDays);
		setSlotMinutes(hours.slotMinutes);
		// Only a new `hours` decides; the draft is read as it is then.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hours]);
	const invalid = invalidConsultationDays(days);
	const overlapping = overlappingConsultationDays(days);
	const empty = days.every((d) => !d.enabled);
	const updateDay = (weekday: number, patch: Partial<ConsultationDay>) =>
		setDays((all) =>
			all.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d))
		);
	const updateWindow = (
		day: ConsultationDay,
		index: number,
		patch: Partial<ConsultationWindow>
	) =>
		updateDay(day.weekday, {
			windows: day.windows.map((w, i) =>
				i === index ? { ...w, ...patch } : w
			)
		});

	const onceStart = onTheDay(once.day, once.start);
	/* An end at 00:00 after a later start is the next midnight, so
	   23:00–00:00 stays one hour. */
	const endsAtMidnight =
		once.start !== null &&
		once.end !== null &&
		once.end.hour() === 0 &&
		once.end.minute() === 0 &&
		(once.start.hour() > 0 || once.start.minute() > 0);
	const onceEnd = endsAtMidnight
		? onTheDay(once.day?.add(1, 'day') ?? null, once.end)
		: onTheDay(once.day, once.end);
	const onceInvalid =
		!(onceEnd > onceStart) || onceEnd.getTime() <= now.getTime();
	/* Released over a Sperrzeit: allowed, said so (Frank: short notice
	   overrides what was blocked). */
	const refusedHere =
		blockerConflict !== undefined &&
		blockerConflict.start.getTime() === onceStart.getTime() &&
		blockerConflict.end.getTime() === onceEnd.getTime();
	const overBlocker =
		refusedHere ||
		entries.some(
			(e) =>
				e.type === 'blocker' &&
				new Date(e.start) < onceEnd &&
				new Date(e.end) > onceStart
		);

	const modeSwitch = onSaveOneOff && (
		<div
			className="calendarNewEntry__tabs"
			role="radiogroup"
			aria-label={t('calendar.consultationHours.mode')}
		>
			{MODES.map((value) => (
				<button
					key={value}
					type="button"
					role="radio"
					className="calendarNewEntry__tab"
					aria-checked={shown === value}
					tabIndex={shown === value ? 0 : -1}
					onClick={() => setMode(value)}
					onKeyDown={(event) =>
						onRovingRadioKey(event, MODES, shown, setMode)
					}
					data-cy={`consultation-mode-${value}`}
				>
					{t(`calendar.consultationHours.modes.${value}`)}
				</button>
			))}
		</div>
	);

	const onceContent = (
		<div
			className="calendarHours calendarConsultation__once"
			role="group"
			aria-label={t('calendar.consultationHours.modes.once')}
		>
			<p className="calendarConsultation__hint">
				{t('calendar.consultationHours.onceHint')}
			</p>
			<div className="calendarDialog__fields calendarConsultation__onceRow">
				<OrisoDatePicker
					label={t('calendar.consultationHours.date')}
					value={once.day}
					onChange={(day) => setOnce((o) => ({ ...o, day }))}
					minDate={dayjs(now).startOf('day')}
					weekStart={1}
					disabled={saving}
					id="consultation-once-date"
				/>
				<div className="calendarDialog__times">
					<OrisoTimePicker
						label={t('calendar.consultationHours.from')}
						ampm={false}
						value={once.start}
						onChange={(start) => setOnce((o) => ({ ...o, start }))}
						error={onceInvalid}
						disabled={saving}
						cancelLabel={t('app.cancel')}
						id="consultation-once-start"
					/>
					<OrisoTimePicker
						label={t('calendar.consultationHours.to')}
						ampm={false}
						value={once.end}
						onChange={(end) => setOnce((o) => ({ ...o, end }))}
						error={onceInvalid}
						disabled={saving}
						cancelLabel={t('app.cancel')}
						id="consultation-once-end"
					/>
				</div>
			</div>
			<div className="calendarHours__select">
				<OrisoSelect
					label={t('calendar.consultationHours.onceNotice')}
					value={String(once.notice)}
					helperText={t('calendar.consultationHours.onceNoticeHint')}
					options={ONE_OFF_NOTICE_MINUTES.map((minutes) => ({
						value: String(minutes),
						label: t(
							minutes === 0
								? 'calendar.consultationHours.onceNoticeNone'
								: minutes < 60
									? 'calendar.consultationHours.onceNoticeMinutes'
									: 'calendar.consultationHours.onceNoticeHours',
							{ count: minutes < 60 ? minutes : minutes / 60 }
						)
					}))}
					onChange={(event) =>
						setOnce((o) => ({
							...o,
							notice: Number(event.target.value)
						}))
					}
					data-cy="consultation-once-notice"
					disabled={saving}
				/>
			</div>
			{overBlocker && (
				<p
					className="calendarConsultation__warning"
					role="status"
					data-testid="consultation-once-over-blocker"
				>
					{t('calendar.consultationHours.overBlocker')}
				</p>
			)}
			{onceInvalid && (
				<p className="calendarDialog__error" role="alert">
					{t('calendar.consultationHours.onceInvalid')}
				</p>
			)}
		</div>
	);

	const weeklyContent = (
		<div
			className="calendarHours"
			role="group"
			aria-label={t('calendar.consultationHours.title')}
		>
			{days.map((day) => {
				const name = dayName(day.weekday);
				const wrong =
					invalid.includes(day.weekday) ||
					overlapping.includes(day.weekday);
				return (
					<div
						key={day.weekday}
						className={`calendarConsultation__row${day.enabled ? '' : ' calendarConsultation__row--off'}`}
						data-testid={`consultation-hours-${day.weekday}`}
					>
						<Switch
							checked={day.enabled}
							onChange={(enabled) =>
								updateDay(day.weekday, { enabled })
							}
							aria-label={name}
							showIcon={false}
							disabled={saving}
						/>
						<span className="calendarHours__day">{name}</span>
						<span className="calendarConsultation__windows">
							{day.windows.map((w, index) => (
								<span
									key={index}
									className="calendarConsultation__times"
									data-testid={`consultation-window-${day.weekday}-${index}`}
								>
									<label className="calendarHours__time">
										<span className="sr-only">
											{t('calendar.workingHours.from', {
												day: name
											})}
										</span>
										<input
											type="time"
											step={900}
											value={w.start}
											disabled={saving || !day.enabled}
											aria-invalid={wrong || undefined}
											onChange={(e) =>
												updateWindow(day, index, {
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
											value={w.end}
											disabled={saving || !day.enabled}
											aria-invalid={wrong || undefined}
											onChange={(e) =>
												updateWindow(day, index, {
													end: e.target.value
												})
											}
										/>
									</label>
									{day.enabled && day.windows.length > 1 ? (
										<button
											type="button"
											className="calendarConsultation__iconButton"
											aria-label={t(
												'calendar.consultationHours.removeWindow',
												{
													day: name,
													start: w.start,
													end: w.end
												}
											)}
											title={t(
												'calendar.consultationHours.removeWindowShort'
											)}
											disabled={saving}
											onClick={() =>
												updateDay(day.weekday, {
													windows: day.windows.filter(
														(_, i) => i !== index
													)
												})
											}
											data-cy={`consultation-remove-${day.weekday}-${index}`}
										>
											<CloseIcon
												aria-hidden="true"
												focusable="false"
											/>
										</button>
									) : (
										<span
											className="calendarConsultation__iconSpace"
											aria-hidden="true"
										/>
									)}
								</span>
							))}
							{day.enabled && (
								<button
									type="button"
									className="calendarConsultation__add"
									aria-label={t(
										'calendar.consultationHours.addWindow',
										{ day: name }
									)}
									disabled={saving}
									onClick={() =>
										updateDay(day.weekday, {
											windows: [
												...day.windows,
												nextConsultationWindow(
													day.windows
												)
											]
										})
									}
									data-cy={`consultation-add-${day.weekday}`}
								>
									<PlusIcon
										aria-hidden="true"
										focusable="false"
									/>
									{t(
										'calendar.consultationHours.addWindowShort'
									)}
								</button>
							)}
						</span>
					</div>
				);
			})}
			{empty && (
				<p
					className="calendarConsultation__hint"
					data-testid="consultation-hours-empty"
				>
					{t('calendar.consultationHours.empty')}
				</p>
			)}
			<div className="calendarHours__holidayBox">
				<div className="calendarHours__row calendarHours__row--holidays">
					<Switch
						checked={autoAccept}
						onChange={setAutoAccept}
						disabled={saving}
						aria-label={t('calendar.consultationHours.autoAccept')}
						showIcon={false}
						data-testid="consultation-hours-auto-accept"
					/>
					<span className="calendarHours__holidays">
						{t('calendar.consultationHours.autoAccept')}
						<small>
							{t(
								autoAccept
									? 'calendar.consultationHours.autoAcceptOn'
									: 'calendar.consultationHours.autoAcceptOff'
							)}
						</small>
					</span>
				</div>
				{/* The MUI 3 select of the design system, like "Bundesland"
				    in the working hours (Frank *12), not own fields. */}
				<div className="calendarHours__region">
					<div className="calendarHours__select">
						<OrisoSelect
							label={t('calendar.consultationHours.noticeDays')}
							value={String(noticeDays)}
							helperText={t(
								'calendar.consultationHours.noticeDaysHint'
							)}
							options={NOTICE_DAYS.map((count) => ({
								value: String(count),
								label: t(
									'calendar.consultationHours.noticeDaysOption',
									{ count }
								)
							}))}
							onChange={(event) =>
								setNoticeDays(Number(event.target.value))
							}
							data-cy="consultation-hours-notice-days"
							disabled={saving}
						/>
					</div>
					<div className="calendarHours__select">
						<OrisoSelect
							label={t('calendar.consultationHours.slotMinutes')}
							value={String(slotMinutes)}
							options={SLOT_MINUTES.map((count) => ({
								value: String(count),
								label: t('calendar.consultationHours.minutes', {
									count
								})
							}))}
							disabled={saving}
							onChange={(event) =>
								setSlotMinutes(
									Number(event.target.value) as SlotMinutes
								)
							}
							data-cy="consultation-hours-slot-minutes"
						/>
					</div>
				</div>
			</div>
			{invalid.length > 0 && (
				<p className="calendarDialog__error" role="alert">
					{t('calendar.consultationHours.invalid')}
				</p>
			)}
			{overlapping.length > 0 && (
				<p className="calendarDialog__error" role="alert">
					{t('calendar.consultationHours.overlaps')}
				</p>
			)}
		</div>
	);

	return {
		testId: 'calendar-consultation-hours-dialog',
		description: t(
			shown === 'once'
				? 'calendar.consultationHours.onceDescription'
				: 'calendar.consultationHours.description'
		),
		icon: <ClockIcon aria-hidden="true" focusable="false" />,
		width: 680,
		actions: [
			{ label: t('app.cancel'), onClick: onClose },
			shown === 'once'
				? {
						label: t('calendar.consultationHours.onceSave'),
						primary: true,
						disabled: saving || onceInvalid,
						onClick: () =>
							onSaveOneOff?.({
								start: onceStart,
								end: onceEnd,
								noticeMinutes: once.notice,
								overBlocker
							}),
						testId: 'consultation-once-save'
					}
				: {
						label: t('calendar.consultationHours.save'),
						primary: true,
						disabled:
							saving ||
							invalid.length > 0 ||
							overlapping.length > 0,
						onClick: () =>
							onSave(
								consultationHoursToApi(days, {
									autoAccept,
									noticeDays,
									slotMinutes
								})
							),
						testId: 'consultation-hours-save'
					}
		],
		content: (
			<div className="calendarConsultation">
				{modeSwitch}
				{shown === 'once' ? onceContent : weeklyContent}
			</div>
		)
	};
};

export const ConsultationHoursDialog = ({
	open,
	hours,
	fullScreen,
	saving = false,
	onSave,
	onClose
}: ConsultationHoursDialogProps) => {
	const { t } = useTranslation();
	const form = useConsultationHoursForm({ hours, saving, onSave, onClose });
	return (
		<M3Dialog
			open={open}
			title={t('calendar.consultationHours.title')}
			description={form.description}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			data-testid={form.testId}
			actions={form.actions}
		>
			{form.content}
		</M3Dialog>
	);
};
