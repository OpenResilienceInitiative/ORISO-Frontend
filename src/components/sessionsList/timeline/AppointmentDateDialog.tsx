/**
 * Create or move a 1:1 appointment inside its conversation (FE#1960). Since
 * #2252 it renders the shared invitation/appointment dialog
 * (`InvitationDialog`, variant `appointment`); this wrapper owns the API
 * call, the reload signal and the notice in the conversation.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiMoveSessionAppointment } from '../../../api/apiSessionAppointments';
import { FETCH_ERRORS } from '../../../api/fetchData';
import {
	isRoomNotEncryptedError,
	notifyDirectLinksChanged
} from '../../../api/apiDirectLinks';
import type { DirectLink } from '../../conversationCreate/directLink/directLink';
import { DirectLinkShareDialog } from '../../conversationCreate/directLink/DirectLinkShareDialog';
import { InvitationDialog } from '../../directInvitation/InvitationDialog';
import type { InvitationDialogValue } from '../../directInvitation/invitationModel';
import {
	InvitationAfterAppointmentError,
	sameSlot,
	saveAppointmentInvitation,
	type SavedAppointment
} from '../../directInvitation/saveAppointmentInvitation';
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

	/* The appointment exists although its link failed: a retry only adds
	   the link (one save path with the calendar), after storing a changed
	   time or Art. */
	const [savedAppointment, setSavedAppointment] =
		useState<SavedAppointment>();

	const save = async (value: InvitationDialogValue) => {
		const { appointment } = value;
		if (!appointment) return;
		const { start, end } = appointment;
		const withInvite = !isMove && allowGuestInvite && value.link !== null;
		/* What the conversation and the calendar already know: nothing on the
		   first try; on a retry, the stored appointment's time and Art. */
		const retry = savedAppointment;
		const timeChanged =
			retry !== undefined && !sameSlot(retry.slot, appointment);
		const stored =
			retry === undefined || timeChanged || retry.kind !== value.kind;
		const announce = () =>
			sendNotice({
				kind: isMove || timeChanged ? 'moved' : 'created',
				start,
				end,
				sessionId,
				matrixRoomId
			});
		setSaving(true);
		setError(undefined);
		let invitation: DirectLink | undefined;
		try {
			if (isMove) {
				await apiMoveSessionAppointment(
					sessionId,
					appointmentId,
					toAppointmentSlot(start, end)
				);
			} else {
				invitation = (
					await saveAppointmentInvitation({
						sessionId,
						slot: appointment,
						kind: value.kind,
						link: withInvite ? value.link : null,
						saved: savedAppointment
					})
				).invitation;
			}
		} catch (cause) {
			setSaving(false);
			if (cause instanceof InvitationAfterAppointmentError) {
				setSavedAppointment({
					appointmentId: cause.appointmentId,
					slot: appointment,
					kind: value.kind
				});
				setError(
					(await isRoomNotEncryptedError(cause.cause))
						? `${t('directInvitation.dialog.roomNotEncrypted')} ${t(
								'directInvitation.dialog.appointmentSaved'
							)}`
						: t(
								'directInvitation.dialog.linkFailedAfterAppointment'
							)
				);
				/* The appointment was stored or changed although the link
				   failed: calendar and conversation hear of it now. */
				if (stored) notifyAppointmentsChanged();
				if (retry === undefined || timeChanged) await announce();
				return;
			}
			setError(
				(await isRoomNotEncryptedError(cause))
					? t('directInvitation.dialog.roomNotEncrypted')
					: t(
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
		/* A retry after a failed link left its notice already, unless it
		   moved the appointment since. */
		if (retry === undefined || timeChanged) await announce();
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
			withKind={!isMove}
			onSubmit={save}
			onClose={onClose}
			saving={saving}
			error={error}
			fullScreen={fullScreen}
		/>
	);
};
