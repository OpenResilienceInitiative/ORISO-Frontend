/**
 * A version counter for "what the Matrix client knows about this room".
 *
 * The app replaces its Matrix client at runtime (token refresh, re-init).
 * The new client starts with no rooms and receives them with its first sync.
 * Anything that read the room from the old client, or subscribed to the old
 * client's events, is stale from that moment and never recovers on its own:
 * the Activity preview then showed "chat preview not available yet" for a
 * case the counsellor owns (Frank, 2026-11-16).
 *
 * The counter bumps when the client is replaced, when the current client
 * learns about `roomId` and when it finishes a sync. Put it into the deps of
 * every effect or memo that reads the room or subscribes to its events.
 */

import { useContext, useEffect, useState } from 'react';
import { MatrixClientContext } from '../globalState/context/MatrixClientContext';
import { getMatrixClientService } from '../services/matrixClientRegistry';

// ClientEvent.Room / ClientEvent.Sync, without importing matrix-js-sdk here
// (it is heavy and hangs the jsdom test workers of the components using this).
const CLIENT_ROOM = 'Room';
const CLIENT_SYNC = 'sync';

type Client = {
	on?: (event: any, listener: (...args: any[]) => void) => unknown;
	removeListener?: (
		event: any,
		listener: (...args: any[]) => void
	) => unknown;
};

export const useMatrixRoomVersion = (roomId: string | null | undefined) => {
	const context = useContext(MatrixClientContext);
	const service = context?.matrixClientService ?? getMatrixClientService();
	const [version, setVersion] = useState(0);

	useEffect(() => {
		const bump = () => setVersion((current) => current + 1);
		const onRoom = (room: { roomId?: string } | null | undefined) => {
			if (roomId && room?.roomId === roomId) bump();
		};
		const onSync = (state: string) => {
			if (state === 'PREPARED') bump();
		};
		let client: Client | null = null;
		let bound = false;
		const detach = () => {
			client?.removeListener?.(CLIENT_ROOM, onRoom);
			client?.removeListener?.(CLIENT_SYNC, onSync);
		};
		const bindCurrentClient = () => {
			const next = (service?.getClient?.() as Client | null) ?? null;
			if (next === client) return;
			detach();
			client = next;
			client?.on?.(CLIENT_ROOM, onRoom);
			client?.on?.(CLIENT_SYNC, onSync);
			// The first bind is what this render already read; a later one
			// is a replacement whose rooms differ.
			if (bound) bump();
			bound = true;
		};
		const unsubscribe = service?.onClientChange?.(bindCurrentClient);
		bindCurrentClient();
		return () => {
			unsubscribe?.();
			detach();
		};
	}, [service, roomId]);

	return version;
};
