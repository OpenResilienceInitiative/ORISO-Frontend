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
import { OrisoSelect } from '../form/OrisoSelect';
import { useWeekdayNames } from './WorkingHoursDialog';
import {
	consultationHoursToApi,
	consultationRows,
	invalidConsultationRows,
	MAX_NOTICE_DAYS,
	type ConsultationDayRow,
	type ConsultationHours,
	type SlotMinutes
} from './calendarConsultationHours';

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

export const ConsultationHoursDialog = ({
	open,
	hours,
	fullScreen,
	saving = false,
	onSave,
	onClose
}: ConsultationHoursDialogProps) => {
	const { t } = useTranslation();
	const dayName = useWeekdayNames();
	const [rows, setRows] = useState<ConsultationDayRow[]>(() =>
		consultationRows(hours.windows)
	);
	const [autoAccept, setAutoAccept] = useState(hours.autoAccept);
	const [noticeDays, setNoticeDays] = useState(hours.noticeDays);
	const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(
		hours.slotMinutes
	);
	const invalid = invalidConsultationRows(rows);
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
					disabled: saving || invalid.length > 0,
					onClick: () =>
						onSave(
							consultationHoursToApi(
								rows,
								{ autoAccept, noticeDays, slotMinutes },
								hours.windows
							)
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
				<div className="calendarHours__holidayBox">
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
					{/* The MUI 3 select of the design system, like "Bundesland"
					    in the working hours (Frank *12), not own fields. */}
					<div className="calendarHours__region">
						<div className="calendarHours__select">
							<OrisoSelect
								label={t(
									'calendar.consultationHours.noticeDays'
								)}
								value={String(noticeDays)}
								helperText={t(
									'calendar.consultationHours.noticeDaysHint'
								)}
								options={NOTICE_DAYS.map((days) => ({
									value: String(days),
									label: t(
										'calendar.consultationHours.noticeDaysOption',
										{ count: days }
									)
								}))}
								onChange={(event) =>
									setNoticeDays(Number(event.target.value))
								}
								data-cy="consultation-hours-notice-days"
							/>
						</div>
						<div className="calendarHours__select">
							<OrisoSelect
								label={t(
									'calendar.consultationHours.slotMinutes'
								)}
								value={String(slotMinutes)}
								options={SLOT_MINUTES.map((minutes) => ({
									value: String(minutes),
									label: t(
										'calendar.consultationHours.minutes',
										{
											count: minutes
										}
									)
								}))}
								onChange={(event) =>
									setSlotMinutes(
										Number(
											event.target.value
										) as SlotMinutes
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
			</div>
		</M3Dialog>
	);
};
