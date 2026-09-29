import { useCallback, useEffect, useRef, useState } from 'react';
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
	// A poll answered before the server recorded her action must not undo it.
	const actionInFlight = useRef(false);
	const currentSeries = useRef(seriesId);
	currentSeries.current = seriesId;

	useEffect(() => {
		if (!seriesId) return;
		let active = true;
		actionInFlight.current = false;
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
			if (active && !actionInFlight.current) {
				setState(viewStateOf(status));
			}
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, [seriesId, transport]);

	/** Runs a knock or withdrawal; its answer counts only for the same group. */
	const runAction = useCallback(
		(
			pending: JoinRequestViewState,
			action: () => Promise<JoinRequestViewState>,
			onError: (error: unknown) => JoinRequestViewState
		) => {
			if (!seriesId || actionInFlight.current) return;
			actionInFlight.current = true;
			setState(pending);
			const settle = (next: JoinRequestViewState) => {
				if (currentSeries.current !== seriesId) return;
				actionInFlight.current = false;
				setState(next);
			};
			action().then(settle, (error) => settle(onError(error)));
		},
		[seriesId]
	);

	const onRequest = useCallback(() => {
		if (!seriesId || !inviteToken) return;
		runAction(
			'sending',
			() => transport.knock(seriesId, inviteToken).then(viewStateOf),
			(error) =>
				error instanceof JoinRequestLinkInvalidError
					? 'linkInvalid'
					: 'error'
		);
	}, [seriesId, inviteToken, transport, runAction]);

	const onCancel = useCallback(() => {
		if (!seriesId) return;
		runAction(
			'cancelling',
			() => transport.cancelMine(seriesId).then(() => 'idle' as const),
			() => 'pending'
		);
	}, [seriesId, transport, runAction]);

	if (!seriesId || !inviteToken || state === null) return undefined;
	return { state, onRequest, onCancel, onOpenGroup };
};
