export const isMatrixRoomId = (roomId?: string | null): boolean =>
	!!roomId?.startsWith('!');

export const isMatrixSession = (
	rid?: string | null,
	matrixRoomId?: string | null
): boolean => isMatrixRoomId(rid) || isMatrixRoomId(matrixRoomId);
