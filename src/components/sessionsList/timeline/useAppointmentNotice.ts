/**
 * The line a 1:1 appointment change leaves in its conversation (FE#1960). It
 * goes through the normal send path, so the room's encryption covers it. The
 * appointment already changed: a failed notice only tells the person.
 *
 * It carries the slot as data (`appointmentNotice.ts`), so the chat draws it
 * as an appointment card in the reader's language, with the old slot of a
 * move; the sentence stays as its description for previews.
 */
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { apiSendMessage } from '../../../api/apiSendMessage';
import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext,
	UserDataContext
} from '../../../globalState';
import { buildAppointmentNoticePayload } from '../../message/appointmentNotice';
import { SYSTEM_NOTIFICATION_PREFIX } from '../../message/messageConstants';
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
	/** A move: the slot it had before, shown struck through. */
	previousStart?: Date;
	previousEnd?: Date;
}

export const useAppointmentNotice = () => {
	const { t, i18n } = useTranslation();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const { userData } = useContext(UserDataContext);
	const senderName = userData?.displayName || userData?.userName || null;

	return useCallback(
		({
			kind,
			start,
			end,
			sessionId,
			matrixRoomId,
			previousStart,
			previousEnd
		}: AppointmentNotice) => {
			const date = formatEntrySlot(
				{ start, end },
				normalizeTimelineLocale(i18n.resolvedLanguage, i18n.language)
			);
			const payload = buildAppointmentNoticePayload({
				kind,
				start,
				end,
				previousStart,
				previousEnd,
				description: t(appointmentNoticeKey(kind), { date })
			});
			return apiSendMessage(
				`${SYSTEM_NOTIFICATION_PREFIX}${payload}`,
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
