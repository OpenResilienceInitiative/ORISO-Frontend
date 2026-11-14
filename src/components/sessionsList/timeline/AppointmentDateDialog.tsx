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
import {
	apiCreateSessionDirectInvitation,
	notifyDirectLinksChanged
} from '../../../api/apiDirectLinks';
import type { DirectLink } from '../../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../../conversationCreate/directLink/DirectLinkShareDialog';
import { directInvitationSettings } from '../../directInvitation/directInvitationSettings';
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
	/**
	 * #2252: offer "Weitere Personen per Link einladen" when creating
	 * ("Direkteinladung erlauben" allows it). Moving never does.
	 */
	allowGuestInvite?: boolean;
	/** Phones: the dialogs fill the screen. */
	fullScreen?: boolean;
}

/* A conflict (finished conversation, cancelled appointment) reads the same
   whether fetchData names it or hands the response back. */
const isConflict = (cause: unknown) =>
	(cause as Error)?.message === FETCH_ERRORS.CONFLICT ||
	(cause as Response)?.status === 409;

export const AppointmentDateDialog = ({
	sessionId,
	matrixRoomId,
	entry,
	onClose,
	allowGuestInvite = false,
	fullScreen = false
}: AppointmentDateDialogProps) => {
	const { t } = useTranslation();
	const sendNotice = useAppointmentNotice();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const appointmentId = entry?.booking?.appointmentId;
	const isMove = appointmentId !== undefined;
	/* #2252: the invitation link, shown once the appointment exists. */
	const [shared, setShared] = useState<DirectLink>();

	const save = async (value: InvitationDialogValue) => {
		const { appointment } = value;
		if (!appointment) return;
		const { start, end } = appointment;
		const withInvite = !isMove && allowGuestInvite && value.link !== null;
		setSaving(true);
		setError(undefined);
		const slot = toAppointmentSlot(start, end);
		let invitation: DirectLink | undefined;
		try {
			if (withInvite) {
				/* One call: the backend creates the appointment and binds the
				   invitation to it, so a refusal leaves no appointment behind. */
				invitation = await apiCreateSessionDirectInvitation(
					sessionId,
					directInvitationSettings(value)
				);
			} else {
				await (isMove
					? apiMoveSessionAppointment(sessionId, appointmentId, slot)
					: apiCreateSessionAppointment(sessionId, slot));
			}
		} catch (cause) {
			setSaving(false);
			setError(
				t(
					`sessionList.timeline.appointment.dialog.error.${
						isConflict(cause) ? 'conflict' : 'failed'
					}`
				)
			);
			return;
		}
		notifyAppointmentsChanged();
		if (invitation) {
			notifyDirectLinksChanged();
			setSaving(false);
			setShared(invitation);
		} else {
			onClose();
		}
		await sendNotice({
			kind: isMove ? 'moved' : 'created',
			start,
			end,
			sessionId,
			matrixRoomId
		});
	};

	if (shared) {
		return (
			<DirectLinkShareDialog
				open
				link={shared}
				fullScreen={fullScreen}
				onClose={onClose}
			/>
		);
	}

	return (
		<InvitationDialog
			variant="appointment"
			mode={isMove ? 'edit' : 'create'}
			initial={entry ? { start: entry.start, end: entry.end } : undefined}
			allowGuestInvite={!isMove && allowGuestInvite}
			onSubmit={save}
			onClose={onClose}
			saving={saving}
			error={error}
			fullScreen={fullScreen}
		/>
	);
};
