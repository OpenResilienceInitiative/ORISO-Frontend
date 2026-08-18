/**
 * Unread axis (#1147) — reactivity for the client-side unread derivation.
 *
 * Returns a version counter that bumps whenever the Matrix client reports a
 * change that can flip a room between read and unread: unread notification
 * counts and read receipts. Consumers include the returned value in their
 * memo/effect dependencies so `isChatItemUnread` (utils/sessionUnread) is
 * re-evaluated without polling the backend, whose `messagesRead` field is a
 * hard-coded constant.
 */

import { useContext, useEffect, useState } from 'react';
import { RoomEvent } from 'matrix-js-sdk';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import { getMatrixClientService } from '../services/matrixClientRegistry';

export const useUnreadVersion = (): number => {
	// Context (when rendered inside MatrixClientProvider) re-renders us once
	// the client finishes bootstrapping; the registry covers everything else.
	const context = useContext(MatrixClientContext);
	const service = context?.matrixClientService ?? getMatrixClientService();

	const [version, setVersion] = useState(0);

	useEffect(() => {
		const client = service?.getClient();
		if (!client) {
			return undefined;
		}

		const bump = () => setVersion((current) => current + 1);
		client.on(RoomEvent.UnreadNotifications as any, bump);
		client.on(RoomEvent.Receipt as any, bump);

		return () => {
			client.removeListener(RoomEvent.UnreadNotifications as any, bump);
			client.removeListener(RoomEvent.Receipt as any, bump);
		};
	}, [service]);

	return version;
};
