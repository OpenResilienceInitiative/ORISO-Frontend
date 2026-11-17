import type { TopicsDataInterface } from '../../globalState/interfaces';
import { getRegistrationTopicDisplay } from '../registration/registrationDesign/registrationDesign';
import { getModalityIfKnown, Modality } from '../session/getModality';
import type { CallConversation } from './callParty';
import type { OrisoCallType } from './widget/useElementCallWidget';

export interface CallConversationParams {
	/** `orisoCallType`: which view the call starts in. */
	callType: OrisoCallType;
	/**
	 * `orisoTopic`: what the call's header calls the conversation — a 1:1's
	 * topic, a group chat's own name — or `null` to send none.
	 */
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
 * The topic: for a 1:1 call, the session's Beratungsthema as the
 * registration names it in `language` (as `useTopicName` does) — never a
 * group chat's subject line, which is not a Beratungsthema. For a group
 * call, the group chat's own name, the one its card and header show: the
 * #2233 live test (16 Nov) had a team call titled "Anruf" while the chat
 * read "QA Moabit · Brieftriage zu viert 08.11". Element Call shows it as
 * the title as it is. `null` when neither is known.
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
			topic: chatNameOf(chat)
		};
	}
	return {
		callType: 'single',
		topic: topicOf(conversation, topics, language)
	};
};

/** What the call widget is opened with: its lobby, kind and title. */
export interface CallWidgetEntry extends CallConversationParams {
	/** `skipLobby`: straight into the call, without Element Call's lobby. */
	skipLobby: boolean;
}

/**
 * How a call opens (FE#2209 live test, 16 Nov).
 *
 * Everybody skips Element Call's lobby: members chose their devices in
 * ORISO's own check, and a guest who came through a call's shared link chose
 * them on the link's page and in the knock wait (`SharedCallGuest` hands that
 * choice to the call). A guest used to meet a second, plain lobby ("Anruf
 * beitreten") after being let in.
 *
 * A guest has no conversation and must not learn it (UserService#1487): the
 * call's topic names the advice seeker's Beratungsthema, so a guest's call is
 * called `guestTitle`, a neutral word, instead of "Anruf". It is a `group`
 * call for the guest, as before: the guest makes it at least three people.
 */
export const callWidgetEntryOf = (
	call: { sharedCallGuest?: string; isGroup?: boolean },
	conversation: CallConversation | null | undefined,
	topics: readonly TopicsDataInterface[] | null | undefined,
	language: string | undefined,
	guestTitle: string
): CallWidgetEntry => ({
	skipLobby: true,
	...(call.sharedCallGuest
		? { callType: 'group', topic: guestTitle.trim() || null }
		: callConversationParamsOf(
				!!call.isGroup,
				conversation,
				topics,
				language
			))
});

/** A group chat's name as its card shows it; `null` when it has none. */
const chatNameOf = (chat: CallConversation['chat']): string | null => {
	const name = typeof chat?.topic === 'string' ? chat.topic.trim() : '';
	return name || null;
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
