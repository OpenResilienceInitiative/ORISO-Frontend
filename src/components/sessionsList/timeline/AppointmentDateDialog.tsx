/**
 * Create or move a 1:1 appointment inside its conversation (FE#1960). The
 * same date and time controls as group date creation, in the house dialog.
 */
import * as React from 'react';
import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
	apiCreateSessionAppointment,
	apiMoveSessionAppointment
} from '../../../api/apiSessionAppointments';
import { FETCH_ERRORS } from '../../../api/fetchData';
import { OrisoDatePicker } from '../../form/OrisoDatePicker';
import { OrisoTimePicker } from '../../form/OrisoTimePicker';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import {
	appointmentSlotError,
	notifyAppointmentsChanged,
	toAppointmentSlot
} from './conversationAppointments';
import type { FutureEntry } from './timelineModel';
import { useAppointmentNotice } from './useAppointmentNotice';

const DEFAULT_HOUR = 10;
const DEFAULT_MINUTES = 60;

const at = (day: Dayjs | null, time: Dayjs | null) =>
	day && time
		? day
				.hour(time.hour())
				.minute(time.minute())
				.second(0)
				.millisecond(0)
				.toDate()
		: null;

export interface AppointmentDateDialogProps {
	sessionId: number;
	matrixRoomId?: string;
	/** Set: move this appointment. Absent: create a new one. */
	entry?: FutureEntry;
	onClose: () => void;
}

export const AppointmentDateDialog = ({
	sessionId,
	matrixRoomId,
	entry,
	onClose
}: AppointmentDateDialogProps) => {
	const { t } = useTranslation();
	const sendNotice = useAppointmentNotice();
	const initialStart = entry
		? dayjs(entry.start)
		: dayjs().add(1, 'day').hour(DEFAULT_HOUR).minute(0);
	const [day, setDay] = useState<Dayjs | null>(initialStart);
	const [startTime, setStartTime] = useState<Dayjs | null>(initialStart);
	const [endTime, setEndTime] = useState<Dayjs | null>(
		entry?.end
			? dayjs(entry.end)
			: initialStart.add(DEFAULT_MINUTES, 'minute')
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const appointmentId = entry?.booking?.appointmentId;
	const isMove = appointmentId !== undefined;

	const save = async () => {
		const start = at(day, startTime);
		const end = at(day, endTime);
		const slotError = appointmentSlotError({ start, end }, new Date());
		if (slotError || !start || !end) {
			setError(
				t(`sessionList.timeline.appointment.dialog.error.${slotError}`)
			);
			return;
		}
		setSaving(true);
		setError(undefined);
		const slot = toAppointmentSlot(start, end);
		try {
			await (isMove
				? apiMoveSessionAppointment(sessionId, appointmentId, slot)
				: apiCreateSessionAppointment(sessionId, slot));
		} catch (cause) {
			setSaving(false);
			setError(
				t(
					`sessionList.timeline.appointment.dialog.error.${
						(cause as Error)?.message === FETCH_ERRORS.CONFLICT
							? 'conflict'
							: 'failed'
					}`
				)
			);
			return;
		}
		notifyAppointmentsChanged();
		onClose();
		await sendNotice({
			kind: isMove ? 'moved' : 'created',
			start,
			end,
			sessionId,
			matrixRoomId
		});
	};

	return (
		<M3Dialog
			open
			data-testid="appointment-date-dialog"
			title={t(
				`sessionList.timeline.appointment.dialog.${isMove ? 'moveTitle' : 'createTitle'}`
			)}
			description={t(
				'sessionList.timeline.appointment.dialog.description'
			)}
			width={400}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t(
						`sessionList.timeline.appointment.dialog.${isMove ? 'moveAction' : 'createAction'}`
					),
					onClick: save,
					primary: true,
					disabled: saving
				}
			]}
		>
			<div className="appointmentDateDialog">
				<OrisoDatePicker
					label={t('sessionList.timeline.appointment.dialog.date')}
					value={day}
					onChange={setDay}
					minDate={dayjs().startOf('day')}
					weekStart={1}
				/>
				<div className="appointmentDateDialog__times">
					<OrisoTimePicker
						label={t(
							'sessionList.timeline.appointment.dialog.start'
						)}
						ampm={false}
						value={startTime}
						onChange={setStartTime}
						cancelLabel={t('app.cancel')}
					/>
					<OrisoTimePicker
						label={t('sessionList.timeline.appointment.dialog.end')}
						ampm={false}
						value={endTime}
						onChange={setEndTime}
						cancelLabel={t('app.cancel')}
					/>
				</div>
				{error && (
					<p className="appointmentDateDialog__error" role="alert">
						{error}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
