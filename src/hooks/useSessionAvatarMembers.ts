import { useEffect, useState } from 'react';
import { apiGetChatMembers } from '../api/apiGetChatMembers';

/** Called once by the open session view, shared by all message rows. */
export const useSessionAvatarMembers = (
	chatId?: number,
	accountId?: string
): UserService.Schemas.ChatMemberResponseDTO[] => {
	const key =
		chatId !== undefined && accountId ? `${accountId}/${chatId}` : null;
	const [result, setResult] = useState<{
		key: string | null;
		members: UserService.Schemas.ChatMemberResponseDTO[];
	}>({ key: null, members: [] });

	useEffect(() => {
		// Discard earlier keys, including a return to an account before a request settles.
		setResult({ key, members: [] });
		if (!key || chatId === undefined) return;
		let cancelled = false;
		apiGetChatMembers(chatId)
			.then((response) => {
				if (!cancelled)
					setResult({ key, members: response.members ?? [] });
			})
			.catch(() => {
				if (!cancelled) setResult({ key, members: [] });
			});
		return () => {
			cancelled = true;
		};
	}, [key, chatId]);

	// Hide the prior chat/account before the replacement request resolves.
	return result.key === key ? result.members : [];
};
