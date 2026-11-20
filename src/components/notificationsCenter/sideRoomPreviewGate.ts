import { RoomEvent } from 'matrix-js-sdk';
import { useCallback, useContext, useEffect, useState } from 'react';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { apiGetTeamDiscussion } from '../../api/apiTeamDiscussion';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';

export type SideRoom = {
	sessionId: number;
	room: string;
	kind: 'supervision' | 'team';
};

/** Confirm each requested side room against its case and current membership. */
export const useSideRoomPreviewGate = (
	rooms: SideRoom[],
	userId?: string,
	username?: string
) => {
	const service = useContext(MatrixClientContext)?.matrixClientService;
	const matrixClient = service?.getClient();
	const [revision, setRevision] = useState(0);
	const [answer, setAnswer] = useState<{
		key: string;
		allowed: string[];
		service?: typeof service;
		client?: typeof matrixClient;
		userId?: string;
		username?: string;
	}>({
		key: '',
		allowed: []
	});
	const key = JSON.stringify([rooms, revision]);

	useEffect(() => {
		let cancelled = false;
		const [requested]: [SideRoom[], number] = JSON.parse(key);
		setAnswer({
			key,
			allowed: [],
			service,
			client: matrixClient,
			userId,
			username
		});
		const lookups = new Map<string, Promise<string[]>>();
		for (const { sessionId, kind } of requested) {
			const lookupKey = `${sessionId}:${kind}`;
			if (!lookups.has(lookupKey)) {
				lookups.set(
					lookupKey,
					kind === 'supervision'
						? apiGetSessionSupervisors(sessionId)
								.then((items) =>
									items
										.map((item) => item.matrixRoomId)
										.filter((id): id is string => !!id)
								)
								.catch(() => [])
						: apiGetTeamDiscussion(sessionId)
								.then((discussion) =>
									discussion?.matrixRoomId
										? [discussion.matrixRoomId]
										: []
								)
								.catch(() => [])
				);
			}
		}
		Promise.all(
			requested.map(async ({ sessionId, kind, room }) => {
				const ids = await lookups.get(`${sessionId}:${kind}`);
				return ids?.includes(room)
					? `${sessionId}:${kind}:${room}`
					: null;
			})
		).then((allowed) => {
			if (!cancelled)
				setAnswer({
					key,
					service,
					client: matrixClient,
					userId,
					username,
					allowed: allowed.filter(
						(item): item is string => item !== null
					)
				});
		});
		return () => {
			cancelled = true;
		};
	}, [key, service, matrixClient, userId, username]);

	useEffect(() => {
		const [requested]: [SideRoom[], number] = JSON.parse(key);
		if (!requested.length) return;
		let client = service?.getClient();
		const changed = () => setRevision((value) => value + 1);
		const onMembership = (room: { roomId: string }) => {
			if (requested.some((item) => item.room === room?.roomId)) changed();
		};
		client?.on(RoomEvent.MyMembership, onMembership);
		const unsubscribe = service?.onClientChange((next) => {
			client?.off(RoomEvent.MyMembership, onMembership);
			client = next;
			client?.on(RoomEvent.MyMembership, onMembership);
			changed();
		});
		return () => {
			client?.off(RoomEvent.MyMembership, onMembership);
			unsubscribe?.();
		};
	}, [service, key]);

	return useCallback(
		(side: SideRoom) =>
			answer.key === key &&
			answer.service === service &&
			answer.client === matrixClient &&
			answer.userId === userId &&
			answer.username === username &&
			answer.allowed.includes(
				`${side.sessionId}:${side.kind}:${side.room}`
			) &&
			service?.getClient()?.getRoom(side.room)?.getMyMembership() ===
				'join',
		[answer, key, service, matrixClient, userId, username]
	);
};
