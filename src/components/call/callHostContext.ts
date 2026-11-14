import type { TopicsDataInterface } from '../../globalState/interfaces';
import { getRegistrationTopicDisplay } from '../registration/registrationDesign/registrationDesign';
import { getModalityIfKnown, Modality } from '../session/getModality';
import type { CallConversation } from './callParty';
import type { OrisoCallType } from './widget/useElementCallWidget';

export interface CallConversationParams {
	/** `orisoCallType`: which view the call starts in. */
	callType: OrisoCallType;
	/** `orisoTopic`: the 1:1 conversation's topic, or `null` to send none. */
	topic: string | null;
}

/**
 * What the call is told about its conversation (FE#2233 checkpoint 4).
 *
 * The kind: a 1:1 call is `single` whatever the conversation is stamped —
 * team-agency 1:1 sessions were stamped `INTERNAL_GROUP` (see
 * `erstantwortRoomGate`), so the call's own `isGroup` decides that. A group
 * call is a `circle` only for a Gesprächskreis (ADR-006 `SELF_HELP`); every
 * other group — a team group chat, a supervision room, a modality this app
 * does not know — is a `group`.
 *
 * The topic: only for a 1:1 call, the session's Beratungsthema as the
 * registration names it in `language` (as `useTopicName` does). Never a group
 * chat's own subject line. `null` when no topic is known.
 */
export const callConversationParamsOf = (
	isGroup: boolean,
	conversation: CallConversation | null | undefined,
	topics: readonly TopicsDataInterface[] | null | undefined,
	language: string | undefined
): CallConversationParams => {
	if (isGroup) {
		// Only the fields that tell a Gesprächskreis from other groups.
		const chat = conversation?.chat;
		const session = conversation?.session;
		const modality = chat
			? getModalityIfKnown({
					isGroup: true,
					item: {
						conversationType: chat.conversationType,
						repetitive: chat.repetitive,
						repeatCount: chat.repeatCount
					}
				})
			: session
				? getModalityIfKnown({
						isGroup: false,
						item: {
							conversationType: session.conversationType,
							teamSession: session.teamSession
						}
					})
				: undefined;
		return {
			callType: modality === Modality.SELF_HELP ? 'circle' : 'group',
			topic: null
		};
	}
	return {
		callType: 'single',
		topic: topicOf(conversation, topics, language)
	};
};

const topicOf = (
	conversation: CallConversation | null | undefined,
	topics: readonly TopicsDataInterface[] | null | undefined,
	language: string | undefined
): string | null => {
	// A group chat's `topic` is its subject line, not a Beratungsthema.
	if (!conversation || conversation.chat) return null;
	const session = conversation.session;
	const own = typeof session?.topic === 'object' ? session.topic : undefined;
	const id = own?.id ?? session?.mainTopicId;
	const topic = id != null ? topics?.find((entry) => entry.id === id) : null;
	if (topic) {
		return (
			getRegistrationTopicDisplay(topic, language)?.title ||
			topic.name ||
			null
		);
	}
	return own?.name || null;
};
