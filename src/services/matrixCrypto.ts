const encodeStorageSegment = (value: string): string =>
	Array.from(new TextEncoder().encode(value), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');

const REQUIRED_STORAGE_ID =
	'Matrix user ID and device ID are required for the crypto store';

export const buildMatrixCryptoAccountStorePrefix = (userId: string): string => {
	if (!userId || userId !== userId.trim()) {
		throw new Error(REQUIRED_STORAGE_ID);
	}
	return `oriso-matrix-${encodeStorageSegment(userId)}-`;
};

export const buildMatrixCryptoStorePrefix = (
	userId: string,
	deviceId: string
): string => {
	if (!deviceId || deviceId !== deviceId.trim()) {
		throw new Error(REQUIRED_STORAGE_ID);
	}
	return `${buildMatrixCryptoAccountStorePrefix(userId)}${encodeStorageSegment(
		deviceId
	)}`;
};
