const encodeStorageSegment = (value: string): string =>
	Array.from(new TextEncoder().encode(value), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');

export const buildMatrixCryptoStorePrefix = (
	userId: string,
	deviceId: string
): string => {
	if (!userId.trim() || !deviceId.trim()) {
		throw new Error(
			'Matrix user ID and device ID are required for the crypto store'
		);
	}

	return `oriso-matrix-${encodeStorageSegment(userId)}-${encodeStorageSegment(
		deviceId
	)}`;
};
