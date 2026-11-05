/**
 * A 1:1 conversation's next appointment below its header (FE#1960), with the
 * same menu as its twin in the list, and the counsellor's way to create one.
 * A backend without the endpoint shows nothing here, not even the create
 * button: there would be nowhere to store the appointment.
 */
import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../../globalState';
import {
	apiGetSessionAppointments,
	type SessionAppointment
} from '../../../api/apiSessionAppointments';
import { SplitButton } from '../../splitButton/SplitButton';
import { AppointmentDateDialog } from './AppointmentDateDialog';
import { RoomNextAppointment } from './AppointmentSplitButton';
import {
	appointmentToBooking,
	onAppointmentsChanged,
	upcomingAppointments
} from './conversationAppointments';
import { buildFutureEntries, type FutureEntry } from './timelineModel';
import { useAppointmentActions } from './useAppointmentActions';

export const ConversationAppointmentSlot = ({
	canChange
}: {
	/** Counsellor of this open conversation: may create and move. */
	canChange: boolean;
}) => {
	const { t } = useTranslation();
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

	const onAction = useAppointmentActions({
		onMove: (entry) => setDialog({ entry })
	});
	if (sessionId === undefined || !Array.isArray(appointments)) return null;

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
				role={
					hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
						? 'asker'
						: 'counsellor'
				}
				onAction={onAction}
				action={
					canChange ? (
						<SplitButton
							size="compact"
							variant="outlined"
							icon={<EventOutlinedIcon />}
							label={t('sessionList.timeline.appointment.create')}
							mainDataCy="create-conversation-appointment"
							onClick={() => setDialog({})}
						/>
					) : undefined
				}
			/>
			{dialog && (
				<AppointmentDateDialog
					sessionId={sessionId}
					matrixRoomId={matrixRoomId}
					entry={dialog.entry}
					onClose={() => setDialog(null)}
				/>
			)}
		</>
	);
};
