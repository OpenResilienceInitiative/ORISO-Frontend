/**
 * Returns true when the id looks like a Matrix room id (starts with '!').
 * After full RC → Matrix migration this helper can collapse to `() => true`.
 */
export const isMatrixRoom = (roomId?: string | null): boolean =>
	Boolean(roomId?.startsWith('!'));

/**
 * Migration-era heuristic for legacy group/rc ids: Matrix room ids start with '!'
 * or contain ':' (e.g. !room:example.org).
 */
export const isMatrixRoomIdHeuristic = (roomId?: string | null): boolean =>
	Boolean(roomId && (isMatrixRoom(roomId) || roomId.includes(':')));
