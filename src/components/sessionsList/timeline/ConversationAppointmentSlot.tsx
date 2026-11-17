/**
 * A 1:1 conversation's next appointment below its header (FE#1960), with the
 * same menu as its twin in the list (ADR-021 §5). Without an appointment the
 * header stays as it was: creating one is a ⋮ menu entry, which this slot
 * offers through `onCreateChange` and answers with its date dialog.
 * A backend without the endpoint offers nothing: there would be nowhere to
 * store the appointment.
 */
import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../../globalState';
import {
	apiConfirmSessionAppointment,
	apiDeclineSessionAppointment,
	apiGetSessionAppointments,
	type SessionAppointment
} from '../../../api/apiSessionAppointments';
import { AppointmentRequestCard } from './AppointmentRequestCard';
import {
	AppointmentDateDialog,
	type AppointmentDateDialogProps
} from './AppointmentDateDialog';
import { useDirectLinksAllowed } from '../../directLinks/useDirectLinksAllowed';
import { useResponsive } from '../../../hooks/useResponsive';
import { RoomNextAppointment } from './AppointmentSplitButton';
import {
	appointmentToBooking,
	notifyAppointmentsChanged,
	onAppointmentsChanged,
	pendingRequests,
	upcomingAppointments
} from './conversationAppointments';
import { useAppointmentNotice } from './useAppointmentNotice';
import { buildFutureEntries, type FutureEntry } from './timelineModel';
import { useAppointmentActions } from './useAppointmentActions';

/* #2252: "Weitere Personen per Link einladen" only where "Direkteinladung
   erlauben" allows a medium. Mounted with the dialog, so the agencies'
   settings are read only when a counsellor opens it. */
const CreateOrMoveDialog = (
	props: Omit<AppointmentDateDialogProps, 'allowGuestInvite' | 'fullScreen'>
) => {
	const allowGuestInvite = useDirectLinksAllowed(!props.entry);
	const { fromL } = useResponsive();
	return (
		<AppointmentDateDialog
			{...props}
			allowGuestInvite={allowGuestInvite}
			fullScreen={!fromL}
		/>
	);
};

/** The `X-Reason` of a refused decision; `null` for another failure. */
const refusalReason = (cause: unknown): string | null =>
	cause instanceof Response && cause.status === 409
		? (cause.headers.get('X-Reason') ?? '')
		: null;

export const ConversationAppointmentSlot = ({
	canChange,
	onCreateChange
}: {
	/** Counsellor of this open conversation: may create and move. */
	canChange: boolean;
	/**
	 * Receives the opener of the create dialog while creating is possible,
	 * and `undefined` otherwise. The header hands it to its ⋮ menu.
	 */
	onCreateChange?: (open?: () => void) => void;
}) => {
	const { activeSession } = useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const sessionId = activeSession?.item.id;
	const matrixRoomId =
		activeSession?.item.matrixRoomId || activeSession?.rid || undefined;
	const [appointments, setAppointments] = useState<SessionAppointment[]>();
	const [dialog, setDialog] = useState<{ entry?: FutureEntry } | null>(null);
	const [reload, setReload] = useState(0);
	const [deciding, setDeciding] = useState(false);
	const [decisionError, setDecisionError] = useState<string>();
	const { t } = useTranslation();
	const sendNotice = useAppointmentNotice();

	useEffect(() => onAppointmentsChanged(() => setReload((n) => n + 1)), []);
	useEffect(() => {
		setDialog(null);
		setAppointments(undefined);
		setDecisionError(undefined);
	}, [sessionId]);
	useEffect(() => {
		if (sessionId === undefined) return undefined;
		let active = true;
		apiGetSessionAppointments(sessionId).then(
			(items) => active && setAppointments(items),
			() => active && setAppointments(undefined)
		);
		return () => {
			active = false;
		};
	}, [sessionId, reload]);

	const onAction = useAppointmentActions({
		onMove: (entry) => setDialog({ entry })
	});
	const canCreate =
		canChange && sessionId !== undefined && Array.isArray(appointments);
	const openCreate = useCallback(() => setDialog({}), []);
	useEffect(() => {
		if (!onCreateChange) return undefined;
		onCreateChange(canCreate ? openCreate : undefined);
		return () => onCreateChange(undefined);
	}, [canCreate, onCreateChange, openCreate]);
	if (sessionId === undefined || !Array.isArray(appointments)) return null;

	const isAsker = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	const request = pendingRequests(appointments, new Date())[0];
	/* FE#2287: confirm or decline the advice seeker's request. The backend
	   checks the time again under locks; a taken time is said, not hidden. */
	const decide = async (kind: 'confirmed' | 'declined') => {
		if (!request) return;
		setDeciding(true);
		setDecisionError(undefined);
		try {
			await (kind === 'confirmed'
				? apiConfirmSessionAppointment(sessionId, request.id)
				: apiDeclineSessionAppointment(sessionId, request.id));
		} catch (cause) {
			setDeciding(false);
			setDecisionError(
				t(
					refusalReason(cause) === 'REQUESTED_TIME_TAKEN'
						? 'sessionList.timeline.appointment.request.taken'
						: 'sessionList.timeline.appointment.request.failed'
				)
			);
			return;
		}
		setDeciding(false);
		await sendNotice({
			kind,
			start: new Date(request.startTime),
			end: new Date(request.endTime),
			sessionId,
			matrixRoomId
		});
		notifyAppointmentsChanged();
	};
	const requestCard = request ? (
		<AppointmentRequestCard
			start={new Date(request.startTime)}
			end={new Date(request.endTime)}
			role={isAsker ? 'asker' : 'counsellor'}
			busy={deciding}
			error={decisionError}
			onConfirm={canChange ? () => void decide('confirmed') : undefined}
			onDecline={canChange ? () => void decide('declined') : undefined}
		/>
	) : undefined;

	const next = upcomingAppointments(appointments, new Date())[0];
	const entry = next
		? buildFutureEntries({
				now: new Date(),
				occurrences: [],
				bookings: [appointmentToBooking(next)],
				seriesToSession: {},
				sessions: [
					{
						sessionId,
						title: '',
						kind: 'one-to-one',
						topic: '',
						lastActivity: 0,
						lastMessage: '',
						matrixRoomId,
						canModerate: canChange
					}
				]
			})[0]
		: undefined;

	return (
		<>
			<RoomNextAppointment
				entry={entry}
				role={isAsker ? 'asker' : 'counsellor'}
				onAction={onAction}
				action={requestCard}
			/>
			{dialog && (
				<CreateOrMoveDialog
					sessionId={sessionId}
					matrixRoomId={matrixRoomId}
					entry={dialog.entry}
					onClose={() => setDialog(null)}
				/>
			)}
		</>
	);
};
