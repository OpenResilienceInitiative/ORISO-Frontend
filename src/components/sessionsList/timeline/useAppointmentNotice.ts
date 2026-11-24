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
import {
	buildAppointmentNoticePayload,
	isCardNoticeKind
} from '../../message/appointmentNotice';
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
	/**
	 * A Supervision room (FE#2494): the notice takes the supervision
	 * composer's protected mail path, so only the supervision pair is
	 * notified, never the advice seeker of the case.
	 */
	feedbackMailIntent?: boolean;
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
			previousEnd,
			feedbackMailIntent = false
		}: AppointmentNotice) => {
			const date = formatEntrySlot(
				{ start, end },
				normalizeTimelineLocale(i18n.resolvedLanguage, i18n.language)
			);
			const sentence = t(appointmentNoticeKey(kind), { date });
			// A request and its answer (FE#2287) have no card yet: they stay
			// the plain sentence they were before the card existed.
			const message = isCardNoticeKind(kind)
				? `${SYSTEM_NOTIFICATION_PREFIX}${buildAppointmentNoticePayload(
						{
							kind,
							start,
							end,
							previousStart,
							previousEnd,
							description: sentence
						}
					)}`
				: sentence;
			return apiSendMessage(
				message,
				matrixRoomId ?? sessionId,
				false,
				false,
				sessionId,
				matrixRoomId,
				null,
				false,
				senderName,
				null,
				null,
				undefined,
				false,
				feedbackMailIntent
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
