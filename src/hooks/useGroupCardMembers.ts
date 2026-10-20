import { useEffect, useState } from 'react';
import {
	ClientEvent,
	RoomMemberEvent,
	RoomStateEvent,
	type MatrixClient,
	type Room,
	type RoomMember
} from 'matrix-js-sdk';
import { getMatrixClientService } from '../services/matrixClientRegistry';

export interface GroupCardMembers {
	status: 'loading' | 'ready' | 'error';
	members: readonly RoomMember[];
}

const EMPTY: GroupCardMembers = { status: 'loading', members: [] };
// SDK rooms belong to one client/account. Share hydration across duplicate cards
// and remounts, with only two network loads in flight for a long session list.
const loads = new WeakMap<Room, Promise<void>>();
const queue: (() => void)[] = [];
let activeLoads = 0;
const drain = () => {
	while (activeLoads < 2 && queue.length) queue.shift()!();
};
const loadOnce = (room: Room): Promise<void> => {
	const existing = loads.get(room);
	if (existing) return existing;
	const pending = new Promise<void>((resolve, reject) => {
		queue.push(() => {
			activeLoads++;
			Promise.resolve()
				.then(() => room.loadMembersIfNeeded())
				.then(() => resolve(), reject)
				.finally(() => {
					activeLoads--;
					drain();
				});
		});
	});
	loads.set(room, pending);
	pending.catch(() => loads.delete(room));
	drain();
	return pending;
};

/** Full, live membership for an accessible group card. Never mount for counselling rooms. */
export const useGroupCardMembers = (
	roomId: string | null | undefined,
	enabled: boolean
): GroupCardMembers => {
	const service = getMatrixClientService();
	const [state, setState] = useState<
		(GroupCardMembers & { key: string; client: MatrixClient }) | null
	>(null);
	useEffect(() => {
		if (!enabled || !roomId || !service) return;
		let disposed = false;
		let detach = () => {};
		const bind = (client: MatrixClient | null) => {
			detach();
			setState(null);
			if (!client || disposed) return;
			let alive = true;
			let trackedRoom: Room | null = null;
			let readyRoom: Room | null = null;
			let loadFailed = false;
			const publish = (next: GroupCardMembers) => {
				if (alive && !disposed)
					setState({ ...next, key: roomId, client });
			};
			const update = () => {
				const room = client.getRoom(roomId);
				if (!room) return;
				if (readyRoom === room) {
					publish({
						status: 'ready',
						members: room.getJoinedMembers()
					});
				} else if (trackedRoom !== room) {
					trackedRoom = room;
					loadFailed = false;
					publish(EMPTY);
					loadOnce(room)
						.then(() => {
							readyRoom = room;
							if (trackedRoom === room)
								publish({
									status: 'ready',
									members: room.getJoinedMembers()
								});
						})
						.catch(() => {
							if (trackedRoom === room) {
								trackedRoom = null;
								loadFailed = true;
								publish({ status: 'error', members: [] });
							}
						});
				}
			};
			const onMembers = (
				_event: unknown,
				source: { roomId?: string }
			) => {
				if (source?.roomId === roomId && !loadFailed) update();
			};
			const onRoom = (room: Room) => {
				if (room.roomId === roomId) update();
			};
			client.on(RoomStateEvent.Members, onMembers);
			client.on(RoomMemberEvent.Membership, onMembers);
			client.on(ClientEvent.Room, onRoom);
			const onSync = (state: string, previous: string | null) => {
				if (
					loadFailed &&
					(state === 'PREPARED' || previous === 'ERROR')
				)
					loadFailed = false;
				if (!loadFailed) update();
			};
			client.on(ClientEvent.Sync, onSync);
			update();
			detach = () => {
				alive = false;
				client.off(RoomStateEvent.Members, onMembers);
				client.off(RoomMemberEvent.Membership, onMembers);
				client.off(ClientEvent.Room, onRoom);
				client.off(ClientEvent.Sync, onSync);
			};
		};
		const unsubscribe = service.onClientChange?.(bind);
		bind(service.getClient());
		return () => {
			disposed = true;
			detach();
			unsubscribe?.();
		};
	}, [service, roomId, enabled]);
	return enabled &&
		roomId &&
		state?.key === roomId &&
		state.client === service?.getClient()
		? state
		: EMPTY;
};
