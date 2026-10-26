import type { ListItemInterface } from '../../globalState/interfaces';
import {
	type AvatarChoice,
	chosenAvatarOf,
	counsellorChoiceOf
} from '../../utils/avatarChoice';
import { resolveAnonymousChatDisplayName } from '../../utils/anonymousChatDisplayName';
import { formatMessagePersonName } from '../message/messageNameUtils';

export interface IncomingCaller {
	name: string;
	avatar: {
		userId: string;
		username: string;
		displayName: string;
		avatarDisplayName?: string;
		choice: AvatarChoice | null;
	};
}

/**
 * Who is calling, named and drawn as the session list shows them
 * (ORISO-Frontend#780): the incoming-call popup said "G" and "Someone is
 * calling…". The caller is matched to the conversation by Matrix id, so a
 * caller who is neither party (a group member, a colleague) stays unnamed
 * rather than borrowing somebody else's name and animal.
 */
export const incomingCallerOf = (
	conversation: ListItemInterface | null | undefined,
	callerUserId: string | undefined
): IncomingCaller | null => {
	const item = conversation?.session;
	if (!item || !callerUserId) return null;

	const consultant = conversation.consultant;
	if (consultant && callerUserId === item.consultantMatrixUserId) {
		// The counsellor's public display name, never the legal name (ADR-002).
		const name = formatMessagePersonName(
			consultant.displayName,
			consultant.username
		);
		return name
			? {
					name,
					avatar: {
						userId: callerUserId,
						username: consultant.username,
						displayName: name,
						avatarDisplayName: consultant.displayName,
						choice: counsellorChoiceOf(chosenAvatarOf(consultant))
					}
				}
			: null;
	}

	const user = conversation.user;
	if (user && callerUserId === item.askerMatrixUserId) {
		// The advice seeker's User-ID as the chat header shows it (#1209).
		const name =
			resolveAnonymousChatDisplayName(user) || user.username || '';
		return name
			? {
					name,
					avatar: {
						userId: callerUserId,
						username: user.username,
						displayName: name,
						choice: chosenAvatarOf(user)
					}
				}
			: null;
	}

	return null;
};
