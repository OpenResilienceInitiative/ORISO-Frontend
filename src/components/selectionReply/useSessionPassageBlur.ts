import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { NotificationsContext } from '../../globalState';
import { NOTIFICATION_TYPE_ERROR } from '../../globalState/provider/NotificationsProvider';
import { chatTransportService } from '../../services/chatTransportService';
import { passageBlurRemovedReason } from './passageBlurEvents';
import {
	canBlurPassages,
	type PassageBlurPermissionInput
} from './passageBlurPermission';

export interface UseSessionPassageBlurOptions
	extends PassageBlurPermissionInput {
	/** The conversation's Matrix room. */
	matrixRoomId: string | null | undefined;
	/** Blur event id → Matrix id of the moderator who set it. */
	blurSenders?: Map<string, string>;
}

/**
 * Moderator blur in the real chat (#2229): whether this person may blur,
 * and the handlers the selection layer needs. A blur is a position-only
 * Matrix event; lifting it redacts that event. A failure says so.
 */
export const useSessionPassageBlur = ({
	matrixRoomId,
	blurSenders,
	...permission
}: UseSessionPassageBlurOptions) => {
	const { t: translate } = useTranslation();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const canBlur = canBlurPassages(permission) && Boolean(matrixRoomId);

	const notifyFailed = useCallback(() => {
		addNotification?.({
			notificationType: NOTIFICATION_TYPE_ERROR,
			title: translate('message.selectionReply.blurFailed.title'),
			text: translate('message.selectionReply.blurFailed.text')
		});
	}, [addNotification, translate]);

	const blurPassage = useCallback(
		(
			passage: { eventId: string },
			blur: { start: number; length: number }
		) => {
			if (!matrixRoomId) {
				return;
			}
			chatTransportService
				.sendPassageBlur({
					matrixRoomId,
					targetEventId: passage.eventId,
					start: blur.start,
					length: blur.length
				})
				.catch(notifyFailed);
		},
		[matrixRoomId, notifyFailed]
	);

	const removeBlur = useCallback(
		(eventId: string, blurId: string) => {
			if (!matrixRoomId) {
				return;
			}
			chatTransportService
				.redactMessage({
					matrixRoomId,
					targetEventId: blurId,
					// #2494 *9: the chat shows "Schwärzung aufgehoben".
					reason: passageBlurRemovedReason(eventId)
				})
				.catch(notifyFailed);
		},
		[matrixRoomId, notifyFailed]
	);

	const blurredByFor = useCallback(
		(_eventId: string, blurId: string) => {
			const senderId = blurSenders?.get(blurId);
			if (!senderId || !matrixRoomId) {
				return undefined;
			}
			const member = chatTransportService
				.getMatrixRoom(matrixRoomId)
				?.getMember?.(senderId);
			return member?.name || member?.rawDisplayName || undefined;
		},
		[blurSenders, matrixRoomId]
	);

	return {
		canBlur,
		onBlurPassage: canBlur ? blurPassage : undefined,
		onRemoveBlur: canBlur ? removeBlur : undefined,
		blurredByFor
	};
};
