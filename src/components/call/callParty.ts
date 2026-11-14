import type {
	GroupChatItemInterface,
	ListItemInterface,
	SessionItemInterface,
	TopicSessionInterface
} from '../../globalState/interfaces';
import {
	type AvatarChoice,
	chosenAvatarOf,
	counsellorChoiceOf
} from '../../utils/avatarChoice';
import { resolveAnonymousChatDisplayName } from '../../utils/anonymousChatDisplayName';
import { formatMessagePersonName } from '../message/messageNameUtils';

export interface CallParty {
	name: string;
	avatar: {
		userId: string;
		username: string;
		displayName: string;
		avatarDisplayName?: string;
		choice: AvatarChoice | null;
	};
}

/** A session list item, or the active session with its session as `item`. */
export type CallConversation = Pick<
	ListItemInterface,
	'consultant' | 'user'
> & {
	session?: Partial<
		Pick<
			SessionItemInterface,
			| 'id'
			| 'askerMatrixUserId'
			| 'consultantMatrixUserId'
			// The call's kind and topic (callHostContext, FE#2233).
			| 'mainTopicId'
			| 'conversationType'
			| 'teamSession'
		>
	> & {
		/*
		 * The session's topic. The active session's item is typed as a
		 * session or a group chat, whose `topic` is a subject line (a
		 * string) — which is never a Beratungsthema.
		 */
		topic?: Partial<Pick<TopicSessionInterface, 'id' | 'name'>> | string;
	};
	/** Set for a group chat; its members say who counsels (see callCounsellors). */
	chat?: Partial<
		Pick<
			GroupChatItemInterface,
			'active' | 'conversationType' | 'repetitive' | 'repeatCount'
		>
	> &
		Pick<GroupChatItemInterface, 'id'>;
};

/**
 * A call participant, named and drawn as the session list shows them
 * (ORISO-Frontend#780): the incoming-call popup said "G" and "Someone is
 * calling…", and the call card said "Called by" the login name. The person
 * is matched to the conversation by Matrix id, so somebody who is neither
 * party (a group member, a supervisor) stays unnamed rather than borrowing
 * somebody else's name and animal.
 */
export const callPartyOf = (
	conversation: CallConversation | null | undefined,
	userId: string | undefined
): CallParty | null => {
	const item = conversation?.session;
	if (!item || !userId) return null;

	const consultant = conversation.consultant;
	if (consultant && userId === item.consultantMatrixUserId) {
		// The counsellor's public display name, never the legal name (ADR-002).
		const name = formatMessagePersonName(
			consultant.displayName,
			consultant.username
		);
		return name
			? {
					name,
					avatar: {
						userId,
						username: consultant.username,
						displayName: name,
						avatarDisplayName: consultant.displayName,
						choice: counsellorChoiceOf(chosenAvatarOf(consultant))
					}
				}
			: null;
	}

	const user = conversation.user;
	if (user && userId === item.askerMatrixUserId) {
		// The advice seeker's User-ID as the chat header shows it (#1209).
		const name =
			resolveAnonymousChatDisplayName(user) || user.username || '';
		return name
			? {
					name,
					avatar: {
						userId,
						username: user.username,
						displayName: name,
						choice: chosenAvatarOf(user)
					}
				}
			: null;
	}

	return null;
};

/**
 * The other party of a one-to-one conversation, as seen from `ownUserId`:
 * whom a running call is with, for the minimized dock (FE#1904).
 */
export const counterpartOf = (
	conversation: CallConversation | null | undefined,
	ownUserId: string | undefined
): CallParty | null => {
	const item = conversation?.session;
	if (!item || !ownUserId) return null;
	return callPartyOf(
		conversation,
		ownUserId === item.consultantMatrixUserId
			? item.askerMatrixUserId
			: item.consultantMatrixUserId
	);
};
