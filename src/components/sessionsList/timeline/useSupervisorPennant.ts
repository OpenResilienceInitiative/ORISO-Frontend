/**
 * The second pennant of a 1:1 header: the counsellor's next appointment with
 * the conversation's supervisor (FE#2494). Its menu answers, cancels or opens
 * it in the calendar; a change leaves its notice in the private internal
 * chat of the two, where the appointment was announced.
 */
import { useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	apiAcceptColleagueAppointment,
	apiCancelColleagueAppointment,
	apiDeclineColleagueAppointment,
	type CalendarEntryDTO
} from '../../../api/apiCalendar';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext
} from '../../../globalState';
import { notifyAppointmentsChanged } from './conversationAppointments';
import {
	colleagueAppointmentEntry,
	colleagueAppointmentMenu,
	useColleagueAppointment
} from './supervisorAppointment';
import { useAppointmentNotice } from './useAppointmentNotice';

/** The calendar of ADR-032 ("Meine Termine"). */
export const CALENDAR_PATH = '/booking/events';

export const useSupervisorPennant = (supervisorId?: string) => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const sendNotice = useAppointmentNotice();
	const dto = useColleagueAppointment(supervisorId);

	const notice = useCallback(
		(
			kind: 'cancelled' | 'declined' | 'confirmed',
			appointment: CalendarEntryDTO
		) => {
			if (typeof appointment.chatId !== 'number') return;
			sendNotice({
				kind,
				start: new Date(appointment.start),
				end: new Date(appointment.end),
				sessionId: appointment.chatId,
				...(appointment.matrixRoomId && {
					matrixRoomId: appointment.matrixRoomId
				})
			});
		},
		[sendNotice]
	);

	const onAction = useCallback(
		(key: string) => {
			if (!dto) return;
			if (key === 'calendar') {
				navigate(CALENDAR_PATH);
				return;
			}
			const call =
				key === 'confirm'
					? apiAcceptColleagueAppointment(dto.id)
					: key === 'decline'
						? apiDeclineColleagueAppointment(dto.id)
						: key === 'cancel'
							? apiCancelColleagueAppointment(dto.id)
							: undefined;
			call?.then(
				() => {
					const kind = (
						{
							cancel: 'cancelled',
							decline: 'declined',
							confirm: 'confirmed'
						} as const
					)[key as 'cancel' | 'decline' | 'confirm'];
					notice(kind, dto);
					notifyAppointmentsChanged();
				},
				() =>
					addNotification?.({
						notificationType: NOTIFICATION_TYPE_ERROR,
						title: t('supervision.appointment.changeFailed'),
						text: ''
					})
			);
		},
		[dto, navigate, notice, addNotification, t]
	);

	return useMemo(
		() =>
			dto
				? {
						entry: colleagueAppointmentEntry(dto),
						withLabel: t('supervision.appointment.withSupervision'),
						withKind: 'supervisor' as const,
						menuItems: colleagueAppointmentMenu(dto, t),
						onAction
					}
				: undefined,
		[dto, onAction, t]
	);
};
