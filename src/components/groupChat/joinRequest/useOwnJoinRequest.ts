import { useCallback, useEffect, useState } from 'react';
import type {
	GroupChatJoinRequestView,
	JoinRequestViewState
} from '../GroupChatNotMember';
import { GroupChatJoinRequestOwnStatus } from './joinRequestModel';
import {
	JoinRequestLinkInvalidError,
	JoinRequestsUnavailableError,
	JoinRequestTransport
} from './joinRequestTransport';

const viewStateOf = (
	status: GroupChatJoinRequestOwnStatus | null
): JoinRequestViewState => {
	switch (status?.status) {
		case 'PENDING':
			return 'pending';
		case 'ADMITTED':
			return 'admitted';
		case 'DECLINED':
			return 'declined';
		default:
			return 'idle';
	}
};

/**
 * The knocking counsellor's side of #1499: what the not-a-member notice
 * shows and does. `undefined` while loading, without the invite link's token
 * and wherever the server offers no knocking — the notice then stays what
 * #1534 shipped.
 */
export const useOwnJoinRequest = (
	seriesId: number | undefined,
	inviteToken: string | undefined,
	transport: JoinRequestTransport,
	{ onOpenGroup }: { onOpenGroup: () => void }
): GroupChatJoinRequestView | undefined => {
	const [state, setState] = useState<JoinRequestViewState | null>(null);

	useEffect(() => {
		if (!seriesId) return;
		let active = true;
		setState(null);
		transport
			.getMine(seriesId)
			.then((status) => active && setState(viewStateOf(status)))
			.catch((error) => {
				if (!active) return;
				setState(
					error instanceof JoinRequestsUnavailableError
						? null
						: 'idle'
				);
			});
		const unsubscribe = transport.watchMine(seriesId, (status) => {
			if (active) setState(viewStateOf(status));
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, [seriesId, transport]);

	const onRequest = useCallback(() => {
		if (!seriesId || !inviteToken) return;
		setState('sending');
		transport
			.knock(seriesId, inviteToken)
			.then((status) => setState(viewStateOf(status)))
			.catch((error) =>
				setState(
					error instanceof JoinRequestLinkInvalidError
						? 'linkInvalid'
						: 'error'
				)
			);
	}, [seriesId, inviteToken, transport]);

	const onCancel = useCallback(() => {
		if (!seriesId) return;
		setState('cancelling');
		transport
			.cancelMine(seriesId)
			.then(() => setState('idle'))
			.catch(() => setState('pending'));
	}, [seriesId, transport]);

	if (!seriesId || !inviteToken || state === null) return undefined;
	return { state, onRequest, onCancel, onOpenGroup };
};
