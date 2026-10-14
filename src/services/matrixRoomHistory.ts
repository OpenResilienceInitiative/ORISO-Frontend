import { MatrixClient, MatrixEvent } from 'matrix-js-sdk';

/** Load one older page through the SDK; keep room content inside Matrix. */
export const loadEarlierMatrixRoomHistory = async (
	client: MatrixClient,
	roomId: string,
	pageSize = 50
): Promise<MatrixEvent[]> => {
	const room = client.getRoom(roomId);
	if (!room) throw new Error('Matrix history room is unavailable');
	await client.scrollback(room, pageSize);
	return room.getLiveTimeline().getEvents();
};
