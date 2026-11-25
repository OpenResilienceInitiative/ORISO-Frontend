import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import {
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext
} from '../../globalState';
import { chatTransportService } from '../../services/chatTransportService';
import { formatClock } from '../voicePlayer/voicePlayerLayout';
import {
	usePassageReplies,
	type PassageReplyToSend
} from './usePassageReplies';
import { useSelectionVoiceRecorder } from './useSelectionVoiceRecorder';

export interface UseSessionPassageRepliesOptions {
	/** The conversation's Matrix room; without one nothing is offered. */
	matrixRoomId: string | null | undefined;
	/** Who answers: supervisors and read-only viewers never do. */
	canReply: boolean;
	isSupervisor?: boolean;
	senderDisplayName?: string | null;
	/**
	 * FE#2494 *7: a side chat (Supervision, Teamberatung) answers passages
	 * marked in the main chat, so it must read the takes from the SAME
	 * recorder the main selection layer records into.
	 */
	sharedVoice?: ReturnType<typeof useSelectionVoiceRecorder>;
	/** Team room: announce with the team-discussion flag, like its composer. */
	teamDiscussion?: boolean;
	/** Supervision room: announce through the protected feedback-mail path. */
	feedbackMailIntent?: boolean;
}

/**
 * Selection reply in the real chat (#2202): the props the selection layer
 * and the composer need, wired to the Matrix transport (ADR-022). Answers
 * collect in the composer, leave as one message, and a failed send keeps
 * them collected and says so.
 */
export const useSessionPassageReplies = ({
	matrixRoomId,
	canReply,
	isSupervisor,
	senderDisplayName,
	sharedVoice,
	teamDiscussion,
	feedbackMailIntent
}: UseSessionPassageRepliesOptions) => {
	const { t: translate } = useTranslation();
	const addNotification = useContext(NotificationsContext)?.addNotification;
	const ownVoice = useSelectionVoiceRecorder();
	const { recorder, takeFor, release } = sharedVoice ?? ownVoice;

	const send = useCallback(
		async (replies: PassageReplyToSend[], typedText: string) => {
			if (!matrixRoomId) {
				throw new Error('No Matrix room');
			}
			await chatTransportService.sendPassageReplies({
				matrixRoomId,
				typedText,
				supervisorMessage: !!isSupervisor,
				teamDiscussion: !!teamDiscussion,
				feedbackMailIntent: !!feedbackMailIntent,
				senderDisplayName,
				labels: {
					voice: (seconds) =>
						`[${translate('message.selectionReply.voiceDuration', {
							duration: formatClock(seconds)
						})}]`
				},
				replies: replies.map(({ voice, ...reply }) => {
					const take = voice ? takeFor(voice.src) : undefined;
					if (voice && !take) {
						// The recording is gone (page memory); never send
						// an answer that silently lost its clip.
						throw new Error('Voice answer no longer available');
					}
					return {
						...reply,
						voice: take
							? {
									file: take.file,
									durationMs: take.durationSec * 1000
								}
							: null
					};
				})
			});
		},
		[
			matrixRoomId,
			isSupervisor,
			teamDiscussion,
			feedbackMailIntent,
			senderDisplayName,
			translate,
			takeFor
		]
	);

	const onSendFailed = useCallback(() => {
		addNotification?.({
			notificationType: NOTIFICATION_TYPE_ERROR,
			title: translate('message.selectionReply.sendFailed.title'),
			text: translate('message.selectionReply.sendFailed.text')
		});
	}, [addNotification, translate]);

	const replies = usePassageReplies({
		send,
		onSendFailed,
		releaseVoice: release,
		conversationKey: matrixRoomId || ''
	});

	return {
		enabled: canReply && Boolean(matrixRoomId),
		recorder,
		voice: { recorder, takeFor, release },
		...replies
	};
};
