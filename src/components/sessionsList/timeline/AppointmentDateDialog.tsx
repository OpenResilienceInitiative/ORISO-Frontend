/**
 * Create or move a 1:1 appointment inside its conversation (FE#1960). Since
 * #2252 it renders the shared invitation/appointment dialog
 * (`InvitationDialog`, variant `appointment`); this wrapper owns the API
 * call, the reload signal and the notice in the conversation.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiCreateSessionAppointment,
	apiMoveSessionAppointment
} from '../../../api/apiSessionAppointments';
import { FETCH_ERRORS } from '../../../api/fetchData';
import { InvitationDialog } from '../../directInvitation/InvitationDialog';
import type { InvitationDialogValue } from '../../directInvitation/invitationModel';
import {
	notifyAppointmentsChanged,
	toAppointmentSlot
} from './conversationAppointments';
import type { FutureEntry } from './timelineModel';
import { useAppointmentNotice } from './useAppointmentNotice';

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
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const appointmentId = entry?.booking?.appointmentId;
	const isMove = appointmentId !== undefined;

	const save = async ({ appointment }: InvitationDialogValue) => {
		if (!appointment) return;
		const { start, end } = appointment;
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
		<InvitationDialog
			variant="appointment"
			mode={isMove ? 'edit' : 'create'}
			initial={entry ? { start: entry.start, end: entry.end } : undefined}
			onSubmit={save}
			onClose={onClose}
			saving={saving}
			error={error}
		/>
	);
};
