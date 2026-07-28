/** Returns true when the id is a Matrix room id. */
export const isMatrixRoom = (roomId?: string | null): boolean =>
	Boolean(roomId?.startsWith('!'));

/** Matrix room IDs start with '!' and contain a homeserver separator. */
export const isMatrixRoomIdHeuristic = (roomId?: string | null): boolean =>
	Boolean(roomId && isMatrixRoom(roomId) && roomId.includes(':'));

/** Resolve the Matrix room used for session routing. */
export const resolveSessionRoomRouteId = (session?: {
	matrixRoomId?: string | null;
}): string | undefined => {
	return isMatrixRoomIdHeuristic(session?.matrixRoomId)
		? session?.matrixRoomId || undefined
		: undefined;
};
