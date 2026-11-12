import { useEffect, useMemo, useState } from 'react';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import {
	apiGetSessionSupervisors,
	type SessionSupervisor
} from '../../api/apiGetSessionSupervisors';
import type { CallConversation } from './callParty';

/**
 * Who in a call is a counsellor, for `org.oriso.call.counsellors` (call
 * design S1). The call shows "Beratung" only for these Matrix ids.
 *
 * The list must come from the userservice, never from the call: the role in
 * a self-published `org.oriso.call.identity` record can be faked, and an
 * advice seeker can create a call room, so its power levels prove nothing.
 * Two sources qualify:
 *   - a one-to-one session: its assigned counsellor
 *     (`session.consultantMatrixUserId`, from the session list DTO) and its
 *     active supervisors (`GET /users/sessions/{id}/supervisors`, ADR-008;
 *     ORISO-ElementCall#144). The userservice answers that for counsellors
 *     and supervisors only, so an advice seeker's call gets no supervisor
 *     label: no label is safer than a guessed one;
 *   - a group chat: the members the server marks `CONSULTANT`
 *     (`GET /users/chat/{id}/members`, role from the account, not the room).
 * Anything else (a shared-call guest, a room the userservice does not know)
 * gets an empty list.
 */

type ChatMember = UserService.Schemas.ChatMemberResponseDTO;

const isMatrixUserId = (value: unknown): value is string =>
	typeof value === 'string' && /^@[^:\s]+:\S+$/.test(value);

/** The counsellors' Matrix ids, deduplicated and sorted (a stable key). */
export const callCounsellorsOf = (
	conversation: CallConversation | null | undefined,
	groupMembers: readonly ChatMember[] = [],
	supervisors: readonly SessionSupervisor[] = []
): string[] => {
	const ids = new Set<string>();
	const assigned = conversation?.session?.consultantMatrixUserId;
	if (isMatrixUserId(assigned)) ids.add(assigned);
	if (conversation?.session && !conversation.chat) {
		supervisors.forEach(({ supervisorMatrixUserId }) => {
			if (isMatrixUserId(supervisorMatrixUserId))
				ids.add(supervisorMatrixUserId);
		});
	}
	if (conversation?.chat) {
		groupMembers.forEach((member) => {
			if (member.role === 'CONSULTANT' && isMatrixUserId(member._id))
				ids.add(member._id);
		});
	}
	return [...ids].sort();
};

/**
 * The counsellors of the conversation a call belongs to. The group chat's
 * members are read once per chat; a failed read leaves the list without
 * them (no label is safer than a guessed one).
 */
export const useCallCounsellors = (
	conversation: CallConversation | null | undefined
): string[] => {
	const chatId =
		conversation?.chat && conversation.chat.active !== false
			? conversation.chat.id
			: undefined;
	const [members, setMembers] = useState<{
		chatId: number | undefined;
		list: ChatMember[];
	}>({ chatId: undefined, list: [] });

	useEffect(() => {
		if (chatId === undefined) return;
		let cancelled = false;
		apiGetChatMembers(chatId)
			.then((response) => {
				if (!cancelled)
					setMembers({ chatId, list: response?.members ?? [] });
			})
			.catch(() => {
				if (!cancelled) setMembers({ chatId, list: [] });
			});
		return () => {
			cancelled = true;
		};
	}, [chatId]);

	const sessionId = conversation?.chat
		? undefined
		: conversation?.session?.id;
	const [supervisors, setSupervisors] = useState<{
		sessionId: number | undefined;
		list: SessionSupervisor[];
	}>({ sessionId: undefined, list: [] });

	useEffect(() => {
		if (sessionId === undefined) return;
		let cancelled = false;
		apiGetSessionSupervisors(sessionId)
			.then((response) => {
				if (!cancelled)
					setSupervisors({
						sessionId,
						list: Array.isArray(response) ? response : []
					});
			})
			.catch(() => {
				if (!cancelled) setSupervisors({ sessionId, list: [] });
			});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	// Another chat's members never count, not even until its answer; nor
	// another session's supervisors.
	const groupMembers = members.chatId === chatId ? members.list : NO_MEMBERS;
	const sessionSupervisors =
		supervisors.sessionId === sessionId ? supervisors.list : NO_SUPERVISORS;
	const ids = callCounsellorsOf(
		conversation,
		groupMembers,
		sessionSupervisors
	);
	const key = ids.join(',');
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => ids, [key]);
};

const NO_MEMBERS: ChatMember[] = [];
const NO_SUPERVISORS: SessionSupervisor[] = [];
