import type { StackParticipant } from '../message/participantStack';
import { isTechnicalMatrixUser } from '../../utils/systemMatrixUsers';

interface GroupMember {
	userId: string;
	name?: string;
	membership: string;
}

/** Group rooms have no silent counsellors; service owners are never people. */
export const groupCardParticipants = (
	members: readonly GroupMember[]
): StackParticipant[] => {
	const seen = new Set<string>();
	return members.flatMap((member) => {
		const userId = member.userId?.trim();
		if (
			!userId ||
			member.membership !== 'join' ||
			isTechnicalMatrixUser(userId) ||
			seen.has(userId)
		)
			return [];
		seen.add(userId);
		return [
			{ userId, username: userId, displayName: member.name || userId }
		];
	});
};
