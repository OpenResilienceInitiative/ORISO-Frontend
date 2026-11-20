import { useEffect, useState } from 'react';
import { apiGetGroupChatInfo } from '../../api';
import type { CallerBanState } from '../../api/apiGetGroupChatInfo';

export const useGroupCallerBan = ({
	askerId,
	chatId,
	roomId,
	active
}: {
	askerId?: string;
	chatId?: number;
	roomId?: string;
	active: boolean;
}): CallerBanState | 'PENDING' => {
	const scope =
		askerId && chatId && roomId && active
			? JSON.stringify([askerId, chatId, roomId])
			: null;
	const [result, setResult] = useState<{
		scope: string;
		state: CallerBanState;
	} | null>(null);

	useEffect(() => {
		setResult(null);
		if (!scope || !chatId) return;
		const controller = new AbortController();

		apiGetGroupChatInfo(chatId, {
			includeCallerBan: true,
			signal: controller.signal
		})
			.then((info) => {
				if (controller.signal.aborted) return;
				const state =
					info.matrixRoomId === roomId
						? (info.callerBanState ?? 'UNKNOWN')
						: 'UNKNOWN';
				setResult({ scope, state });
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setResult({ scope, state: 'UNKNOWN' });
				}
			});

		return () => controller.abort();
	}, [chatId, roomId, scope]);

	if (!scope) return 'UNKNOWN';
	return result?.scope === scope ? result.state : 'PENDING';
};
