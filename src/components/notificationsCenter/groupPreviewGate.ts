import { RoomEvent } from 'matrix-js-sdk';
import { useCallback, useContext, useEffect, useState } from 'react';
import { apiGetGroupChatInfo } from '../../api/apiGetGroupChatInfo';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { decodeUsername } from '../../utils/encryptionHelpers';

type Group = { id: number; room: string; active: boolean; subscribed: boolean };

/** One lookup per group, with membership checked again whenever Matrix changes. */
export const useGroupPreviewGate = (
	groups: Group[],
	username?: string,
	userId?: string
) => {
	const service = useContext(MatrixClientContext)?.matrixClientService;
	const client = service?.getClient();
	const [answers, setAnswers] = useState<{
		key: string;
		username?: string;
		userId?: string;
		service?: typeof service;
		client?: typeof client;
		values: Record<string, boolean>;
	}>({ key: '', values: {} });
	const [revision, setRevision] = useState(0);
	const key = JSON.stringify([groups, revision]);

	useEffect(() => {
		let cancelled = false;
		const [unique]: [Group[], number] = JSON.parse(key);
		setAnswers({ key, username, userId, service, client, values: {} });
		unique.forEach(({ id, room, active, subscribed }) => {
			if (!active || !subscribed || !username) return;
			apiGetGroupChatInfo(id)
				.then((info) => {
					let allowed = false;
					try {
						allowed =
							info.id === id &&
							info.matrixRoomId === room &&
							info.active === true &&
							!info.bannedUsers?.some(
								(name) => decodeUsername(name) === username
							);
					} catch {
						/* malformed identity is not authorization */
					}
					if (!cancelled)
						setAnswers((current) =>
							current.key === key &&
							current.username === username &&
							current.userId === userId &&
							current.service === service &&
							current.client === client
								? {
										...current,
										values: {
											...current.values,
											[room]: allowed
										}
									}
								: current
						);
				})
				.catch(() => {
					if (!cancelled)
						setAnswers((current) =>
							current.key === key &&
							current.username === username &&
							current.userId === userId &&
							current.service === service &&
							current.client === client
								? {
										...current,
										values: {
											...current.values,
											[room]: false
										}
									}
								: current
						);
				});
		});
		return () => {
			cancelled = true;
		};
	}, [key, username, userId, service, client]);

	useEffect(() => {
		let current = service?.getClient();
		const changed = () => setRevision((value) => value + 1);
		const onMembership = (room: { roomId: string }) => {
			const [knownGroups]: [Group[], number] = JSON.parse(key);
			if (knownGroups.some((group) => group.room === room?.roomId))
				changed();
		};
		current?.on(RoomEvent.MyMembership, onMembership);
		const unsubscribe = service?.onClientChange((client) => {
			current?.off(RoomEvent.MyMembership, onMembership);
			current = client;
			current?.on(RoomEvent.MyMembership, onMembership);
			changed();
		});
		return () => {
			current?.off(RoomEvent.MyMembership, onMembership);
			unsubscribe?.();
		};
	}, [service, key]);

	return useCallback(
		(room: string) =>
			answers.key === key &&
			answers.username === username &&
			answers.userId === userId &&
			answers.service === service &&
			answers.client === client &&
			answers.values[room] === true &&
			service?.getClient()?.getRoom(room)?.getMyMembership() === 'join',
		// revision tracks membership events; it is deliberately read by this closure.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[answers, key, username, userId, service, client, revision]
	);
};
