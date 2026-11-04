/**
 * The line a 1:1 appointment change leaves in its conversation (FE#1960). It
 * goes through the normal send path, so the room's encryption covers it. The
 * appointment already changed: a failed notice only tells the person.
 */
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { apiSendMessage } from '../../../api/apiSendMessage';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext,
	UserDataContext
} from '../../../globalState';
import { normalizeTimelineLocale } from '../futureTimelineTime';
import {
	appointmentNoticeKey,
	type AppointmentNoticeKind
} from './conversationAppointments';
import { formatEntrySlot } from './timelineModel';

export interface AppointmentNotice {
	kind: AppointmentNoticeKind;
	start: Date;
	end?: Date;
	sessionId: number;
	matrixRoomId?: string;
}

export const useAppointmentNotice = () => {
	const { t, i18n } = useTranslation();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const { userData } = useContext(UserDataContext);
	const senderName = userData?.displayName || userData?.userName || null;

	return useCallback(
		({ kind, start, end, sessionId, matrixRoomId }: AppointmentNotice) => {
			const date = formatEntrySlot(
				{ start, end },
				normalizeTimelineLocale(i18n.resolvedLanguage, i18n.language)
			);
			return apiSendMessage(
				t(appointmentNoticeKey(kind), { date }),
				matrixRoomId ?? sessionId,
				false,
				false,
				sessionId,
				matrixRoomId,
				null,
				false,
				senderName
			).catch(() => {
				addNotification?.({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: t(
						'sessionList.timeline.appointment.noticeFailed.title'
					),
					text: t(
						'sessionList.timeline.appointment.noticeFailed.text'
					)
				});
			});
		},
		[t, i18n, addNotification, senderName]
	);
};
