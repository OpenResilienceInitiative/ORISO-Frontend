/**
 * A 1:1 conversation's next appointment below its header (FE#1960), with the
 * same menu as its twin in the list (ADR-021 §5). Without an appointment the
 * header stays as it was: creating one is a ⋮ menu entry, which this slot
 * offers through `onCreateChange` and answers with its date dialog.
 * A backend without the endpoint offers nothing: there would be nowhere to
 * store the appointment. An advice seeker's request (FE#2287) shows in the
 * same button, marked "angefragt"; its menu answers or withdraws it.
 */
import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../../globalState';
import {
	apiClaimSessionAppointmentExpiryNotice,
	apiGetSessionAppointments,
	type SessionAppointment
} from '../../../api/apiSessionAppointments';
import { useAppointmentNotice } from './useAppointmentNotice';
import {
	AppointmentDateDialog,
	type AppointmentDateDialogProps
} from './AppointmentDateDialog';
import { useDirectLinksAllowed } from '../../directLinks/useDirectLinksAllowed';
import { useResponsive } from '../../../hooks/useResponsive';
import { RoomNextAppointment } from './AppointmentSplitButton';
import {
	appointmentToBooking,
	nextConversationAppointment,
	onAppointmentsChanged,
	upcomingAppointments
} from './conversationAppointments';
import { lendAppointmentCreate } from './appointmentCreateBridge';
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

	useEffect(() => onAppointmentsChanged(() => setReload((n) => n + 1)), []);
	useEffect(() => {
		setDialog(null);
		setAppointments(undefined);
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

	/*
	 * FE#2287: a request nobody answered by its start was declined by
	 * UserService, which cannot write into the encrypted room. Whoever opens
	 * the conversation first claims the notice and posts it, the way a
	 * counsellor's decline is posted; a lost claim posts nothing.
	 */
	const sendNotice = useAppointmentNotice();
	useEffect(() => {
		if (sessionId === undefined || !Array.isArray(appointments)) return;
		appointments
			.filter((a) => a.expired && a.noticePending)
			.forEach((a) => {
				apiClaimSessionAppointmentExpiryNotice(sessionId, a.id).then(
					() =>
						sendNotice({
							kind: 'expired',
							start: new Date(a.startTime),
							end: new Date(a.endTime),
							sessionId,
							matrixRoomId
						}),
					() => undefined
				);
			});
		// Once per load of the list.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [appointments]);

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
	/* The split button shows the nearest appointment or request (FE#2287). */
	const next = Array.isArray(appointments)
		? nextConversationAppointment(appointments, new Date())
		: undefined;
	/* The chat's cancelled-appointment card offers "Neuen Termin anlegen"
	   with this same opener, so it follows the same rule. */
	const hasUpcoming = Array.isArray(appointments)
		? upcomingAppointments(appointments, new Date()).length > 0
		: false;
	useEffect(() => {
		if (!canCreate || sessionId === undefined) return undefined;
		return lendAppointmentCreate(sessionId, {
			open: openCreate,
			hasUpcoming
		});
	}, [canCreate, sessionId, openCreate, hasUpcoming]);
	if (sessionId === undefined || !Array.isArray(appointments)) return null;

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
				role={
					hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
						? 'asker'
						: 'counsellor'
				}
				onAction={onAction}
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
