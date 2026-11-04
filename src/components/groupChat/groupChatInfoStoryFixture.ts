import * as React from 'react';
import { endpoints } from '../../resources/scripts/endpoints';
import type { GroupChatItemInterface } from '../../globalState/interfaces';

/**
 * #1338: `JoinGroupChatView` polls its group (`GET /service/users/chat/{id}`)
 * every 5 s. This answers with the story's own group, so the view stays as the
 * story set it up. Installed during render, before the view's first effect
 * asks; fetch is restored when the story unmounts.
 */
export const useGroupChatInfoFixture = (
	chat: Pick<GroupChatItemInterface, 'id' | 'active' | 'matrixRoomId'>
) => {
	const restore = React.useRef<(() => void) | null>(null);
	if (!restore.current) {
		const previous = globalThis.fetch;
		const path = new URL(
			endpoints.groupChatBase + chat.id,
			window.location.href
		).pathname;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			if (new URL(url, window.location.href).pathname === path) {
				return new Response(
					JSON.stringify({
						id: chat.id,
						active: chat.active,
						matrixRoomId: chat.matrixRoomId,
						bannedUsers: []
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			return previous(input, init);
		};
		restore.current = () => {
			globalThis.fetch = previous;
		};
	}
	React.useEffect(() => () => restore.current?.(), []);
};
