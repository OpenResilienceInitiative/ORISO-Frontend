import { useEffect, useState } from 'react';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';

export type ServerMemberRole = NonNullable<
	UserService.Schemas.ChatMemberResponseDTO['role']
>;

/** The role badge a participant carries in a group or team chat (#107). */
export type ParticipantRole = 'asker' | 'consultant' | 'supervisor';

/**
 * A supervisor reads along at this Matrix power level
 * (UserService SessionSupervisorFacade.SUPERVISOR_POWER_LEVEL).
 */
export const SUPERVISOR_POWER_LEVEL = 10;

/**
 * Who the participant is: the server knows advice seeker or counsellor; the
 * room's power levels tell whether a counsellor only reads along as
 * supervisor. Unknown stays unknown — no guessed badge.
 */
export const participantRole = (
	serverRole: ServerMemberRole | undefined,
	powerLevel: number | undefined
): ParticipantRole | undefined => {
	if (serverRole === 'ADVICE_SEEKER') return 'asker';
	if (serverRole !== 'CONSULTANT') return undefined;
	return powerLevel === SUPERVISOR_POWER_LEVEL ? 'supervisor' : 'consultant';
};

/**
 * Server role per Matrix user id of the chat's members. The badges are a
 * nicety: a failed read leaves the map empty and the list shows names only.
 */
export const useGroupChatMemberRoles = (
	chatId: number | undefined
): ReadonlyMap<string, ServerMemberRole> => {
	const [roles, setRoles] = useState<ReadonlyMap<string, ServerMemberRole>>(
		() => new Map()
	);

	useEffect(() => {
		setRoles(new Map());
		if (chatId === undefined) return;
		let cancelled = false;
		apiGetChatMembers(chatId)
			.then((response) => {
				if (cancelled) return;
				const next = new Map<string, ServerMemberRole>();
				(response.members ?? []).forEach((member) => {
					if (member._id && member.role)
						next.set(member._id, member.role);
				});
				setRoles(next);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [chatId]);

	return roles;
};
