import { MatrixClient, Room } from 'matrix-js-sdk';

export const MATRIX_ROOM_ENCRYPTION_ALGORITHM = 'm.megolm.v1.aes-sha2';

export const buildMatrixRoomEncryptionInitialState = (): {
	type: 'm.room.encryption';
	state_key: '';
	content: { algorithm: typeof MATRIX_ROOM_ENCRYPTION_ALGORITHM };
} => ({
	type: 'm.room.encryption',
	state_key: '',
	content: {
		algorithm: MATRIX_ROOM_ENCRYPTION_ALGORITHM
	}
});

export const isMatrixRoomEncrypted = (
	client: MatrixClient,
	roomId: string
): boolean => {
	const clientWithEncryptionState = client as MatrixClient & {
		getRoom?: (roomId: string) => Room | null;
		isRoomEncrypted?: (roomId: string) => boolean;
	};
	const room = clientWithEncryptionState.getRoom?.(roomId);

	return (
		clientWithEncryptionState.isRoomEncrypted?.(roomId) ??
		room?.hasEncryptionStateEvent?.() ??
		false
	);
};

export const assertMatrixRoomEncrypted = (
	client: MatrixClient | null | undefined,
	roomId: string
): void => {
	if (!client) {
		throw new Error('Matrix client not initialized');
	}

	if (!isMatrixRoomEncrypted(client, roomId)) {
		throw new Error(
			'Cannot send Matrix event before the target room is confirmed as an encrypted Matrix room'
		);
	}
};
