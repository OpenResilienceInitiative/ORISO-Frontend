/**
 * "Sprechstunden" (ORISO-Frontend#2287): the weekly times advice seekers can
 * book themselves, separate from the working hours, plus how a booking is
 * accepted. Outside the notice period a booking is confirmed at once when
 * "Automatisch bestätigen" is on; otherwise it is a request the counsellor
 * confirms. Only the counsellor edits their own; UserService checks again.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import { useWeekdayNames } from './WorkingHoursDialog';
import {
	consultationHoursToApi,
	consultationRows,
	invalidConsultationRows,
	isNoticeDays,
	MAX_NOTICE_DAYS,
	type ConsultationDayRow,
	type ConsultationHours,
	type SlotMinutes
} from './calendarConsultationHours';

export interface ConsultationHoursDialogProps {
	open: boolean;
	hours: ConsultationHours;
	fullScreen?: boolean;
	onSave: (hours: ConsultationHours) => void;
	onClose: () => void;
}

const SLOT_MINUTES: SlotMinutes[] = [30, 60];

export const ConsultationHoursDialog = ({
	open,
	hours,
	fullScreen,
	onSave,
	onClose
}: ConsultationHoursDialogProps) => {
	const { t } = useTranslation();
	const dayName = useWeekdayNames();
	const [rows, setRows] = useState<ConsultationDayRow[]>(() =>
		consultationRows(hours.windows)
	);
	const [autoAccept, setAutoAccept] = useState(hours.autoAccept);
	const [notice, setNotice] = useState(String(hours.noticeDays));
	const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(
		hours.slotMinutes
	);
	const invalid = invalidConsultationRows(rows);
	const noticeDays = notice.trim() === '' ? Number.NaN : Number(notice);
	const noticeWrong = !isNoticeDays(noticeDays);
	const empty = rows.every((r) => !r.enabled);
	const update = (weekday: number, patch: Partial<ConsultationDayRow>) =>
		setRows((all) =>
			all.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r))
		);

	return (
		<M3Dialog
			open={open}
			title={t('calendar.consultationHours.title')}
			description={t('calendar.consultationHours.description')}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			data-testid="calendar-consultation-hours-dialog"
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t('calendar.consultationHours.save'),
					primary: true,
					disabled: invalid.length > 0 || noticeWrong,
					onClick: () =>
						onSave(
							consultationHoursToApi(rows, {
								autoAccept,
								noticeDays,
								slotMinutes
							})
						),
					testId: 'consultation-hours-save'
				}
			]}
		>
			<div
				className="calendarHours"
				role="group"
				aria-label={t('calendar.consultationHours.title')}
			>
				{rows.map((row) => {
					const name = dayName(row.weekday);
					const wrong = invalid.includes(row.weekday);
					return (
						<div
							key={row.weekday}
							className={`calendarConsultation__row${row.enabled ? '' : ' calendarConsultation__row--off'}`}
							data-testid={`consultation-hours-${row.weekday}`}
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
							<span className="calendarConsultation__times">
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
				<div className="calendarHours__holidayBox calendarConsultation__settings">
					<div className="calendarHours__row calendarHours__row--holidays">
						<Switch
							checked={autoAccept}
							onChange={setAutoAccept}
							aria-label={t(
								'calendar.consultationHours.autoAccept'
							)}
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
					<label className="calendarConsultation__field">
						<span>
							{t('calendar.consultationHours.noticeDays')}
							<small>
								{t('calendar.consultationHours.noticeDaysHint')}
							</small>
						</span>
						<input
							type="number"
							inputMode="numeric"
							min={0}
							max={MAX_NOTICE_DAYS}
							step={1}
							value={notice}
							aria-invalid={noticeWrong || undefined}
							onChange={(e) => setNotice(e.target.value)}
							data-testid="consultation-hours-notice-days"
						/>
					</label>
					<div
						className="calendarConsultation__field"
						role="group"
						aria-label={t('calendar.consultationHours.slotMinutes')}
					>
						<span>
							{t('calendar.consultationHours.slotMinutes')}
						</span>
						<div className="calendarConsultation__segments">
							{SLOT_MINUTES.map((minutes) => (
								<button
									key={minutes}
									type="button"
									aria-pressed={slotMinutes === minutes}
									className={`calendarConsultation__segment${slotMinutes === minutes ? ' calendarConsultation__segment--on' : ''}`}
									onClick={() => setSlotMinutes(minutes)}
									data-testid={`consultation-hours-slot-${minutes}`}
								>
									{t('calendar.consultationHours.minutes', {
										count: minutes
									})}
								</button>
							))}
						</div>
					</div>
				</div>
				{invalid.length > 0 && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.consultationHours.invalid')}
					</p>
				)}
				{noticeWrong && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.consultationHours.noticeInvalid', {
							max: MAX_NOTICE_DAYS
						})}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
