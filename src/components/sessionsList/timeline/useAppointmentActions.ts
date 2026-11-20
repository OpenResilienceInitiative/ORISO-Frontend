/**
 * What the appointment menu does (ADR-021 table). `open` is the pill's click.
 * Group dates: cancel via
 * the series API, duplicate into the create-group form (kept from the old
 * future strip), configure the group. 1:1 appointments: cancel through the
 * conversation's API and leave a notice in it; moving opens the caller's date
 * dialog (FE#1960). A request (FE#2287): the counsellor confirms or
 * declines it, the advice seeker withdraws it through cancel; each leaves its
 * notice in the conversation, and a refusal is said through the app's
 * notifications. Entries marked "kommt bald" never reach this.
 */
import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext,
	SessionTypeContext
} from '../../../globalState';
import { apiSkipChatOccurrence } from '../../../api/apiGetChatOccurrences';
import {
	apiCancelSessionAppointment,
	apiConfirmSessionAppointment,
	apiDeclineSessionAppointment
} from '../../../api/apiSessionAppointments';
import { useSearchParam } from '../../../hooks/useSearchParams';
import { buildCreateGroupChatPath } from '../SessionsListToolbar';
import { notifyAppointmentsChanged } from './conversationAppointments';
import type { FutureEntry } from './timelineModel';
import { useAppointmentNotice } from './useAppointmentNotice';

/** The `X-Reason` of a refused answer; `null` for another failure. */
const refusalReason = (cause: unknown): string | null =>
	cause instanceof Response && cause.status === 409
		? (cause.headers.get('X-Reason') ?? '')
		: null;

export interface AppointmentActionsOptions {
	/** A date was cancelled: drop it from what is shown. */
	onCancelled?: (entry: FutureEntry) => void;
	onError?: () => void;
	/** A 1:1 appointment should move: open the date dialog. */
	onMove?: (entry: FutureEntry) => void;
}

export const useAppointmentActions = ({
	onCancelled,
	onError,
	onMove
}: AppointmentActionsOptions = {}) => {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const sendNotice = useAppointmentNotice();
	const { path: listPath } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<string>('sessionListTab');
	const tabQuery = sessionListTab ? `?sessionListTab=${sessionListTab}` : '';

	return useCallback(
		(key: string, entry: FutureEntry) => {
			const { occurrence, booking } = entry;
			switch (key) {
				case 'open':
					if (entry.matrixRoomId && entry.sessionId !== undefined) {
						navigate(
							`${listPath}/${entry.matrixRoomId}/${entry.sessionId}${tabQuery}`
						);
					}
					return;
				case 'cancel':
					if (occurrence) {
						apiSkipChatOccurrence(
							occurrence.seriesId,
							occurrence.originalStart
						).then(
							() => {
								onCancelled?.(entry);
								notifyAppointmentsChanged();
							},
							() => onError?.()
						);
					} else if (
						booking?.appointmentId &&
						entry.sessionId !== undefined
					) {
						const { sessionId } = entry;
						apiCancelSessionAppointment(
							sessionId,
							booking.appointmentId
						).then(
							() => {
								onCancelled?.(entry);
								notifyAppointmentsChanged();
								return sendNotice({
									kind: entry.requested
										? 'withdrawn'
										: 'cancelled',
									start: entry.start,
									end: entry.end,
									sessionId,
									matrixRoomId: entry.matrixRoomId
								});
							},
							() => {
								onError?.();
								addNotification?.({
									notificationType: NOTIFICATION_TYPE_ERROR,
									title: t(
										'sessionList.timeline.appointment.cancelFailed.title'
									),
									text: t(
										'sessionList.timeline.appointment.cancelFailed.text'
									)
								});
							}
						);
					}
					return;
				case 'confirm':
				case 'decline':
					if (
						entry.requested &&
						booking?.appointmentId &&
						entry.sessionId !== undefined
					) {
						const { sessionId } = entry;
						// The backend checks the time again under locks.
						(key === 'confirm'
							? apiConfirmSessionAppointment
							: apiDeclineSessionAppointment)(
							sessionId,
							booking.appointmentId
						).then(
							() => {
								notifyAppointmentsChanged();
								return sendNotice({
									kind:
										key === 'confirm'
											? 'confirmed'
											: 'declined',
									start: entry.start,
									end: entry.end,
									sessionId,
									matrixRoomId: entry.matrixRoomId
								});
							},
							(cause: unknown) => {
								const taken =
									refusalReason(cause) ===
									'REQUESTED_TIME_TAKEN';
								// A taken or answered request changed: show what is.
								if (refusalReason(cause) !== null)
									notifyAppointmentsChanged();
								addNotification?.({
									notificationType: NOTIFICATION_TYPE_ERROR,
									title: t(
										'sessionList.timeline.appointment.request.failedTitle'
									),
									text: t(
										taken
											? 'sessionList.timeline.appointment.request.taken'
											: 'sessionList.timeline.appointment.request.failed'
									)
								});
							}
						);
					}
					return;
				case 'reschedule':
					if (booking?.appointmentId) onMove?.(entry);
					return;
				case 'duplicate':
					if (occurrence) {
						navigate(
							buildCreateGroupChatPath(
								sessionListTab || undefined
							),
							{
								state: {
									duplicateOccurrence: {
										topic: entry.topic ?? entry.title,
										start: entry.start.toISOString(),
										duration: occurrence.duration,
										modality: occurrence.modality
									}
								}
							}
						);
					}
					return;
				case 'configure':
					if (
						entry.kind === 'group' &&
						entry.canConfigure === true &&
						entry.matrixRoomId &&
						entry.sessionId !== undefined
					) {
						navigate(
							`${listPath}/${entry.matrixRoomId}/${entry.sessionId}/editGroupChat${tabQuery}`,
							{
								state: {
									isEditMode: true,
									prevIsInfoPage: false
								}
							}
						);
					}
					return;
				default:
			}
		},
		[
			navigate,
			listPath,
			sessionListTab,
			tabQuery,
			onCancelled,
			onError,
			onMove,
			t,
			addNotification,
			sendNotice
		]
	);
};
