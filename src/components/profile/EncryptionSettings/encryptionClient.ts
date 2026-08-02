import type { MatrixClient } from 'matrix-js-sdk';
import type { MatrixClientService } from '../../../services/matrixClientService';

type ReadyMatrixClientService = Pick<MatrixClientService, 'getReadyClient'>;

export const resolveReadyEncryptionClient = async (
	clientOverride: MatrixClient | null | undefined,
	service: ReadyMatrixClientService | null
): Promise<MatrixClient | null> => {
	if (clientOverride !== undefined) {
		return clientOverride;
	}

	return service ? service.getReadyClient() : null;
};

/**
 * Crypto bootstrap can be the first operation that exposes a stale Rust
 * outgoing-request queue. Its SDK logger starts device recovery before the
 * operation rejects. Retry only when that recovery actually replaced the
 * client; ordinary setup failures keep their original error and are never
 * repeated blindly.
 */
export const executeWithReadyEncryptionClient = async <T>(
	clientOverride: MatrixClient | null | undefined,
	service: ReadyMatrixClientService | null,
	action: (client: MatrixClient) => Promise<T>
): Promise<T | null> => {
	const initialClient = await resolveReadyEncryptionClient(
		clientOverride,
		service
	);
	if (!initialClient) {
		return null;
	}

	try {
		return await action(initialClient);
	} catch (initialError) {
		if (clientOverride !== undefined || !service) {
			throw initialError;
		}

		const recoveredClient = await service.getReadyClient();
		if (recoveredClient === initialClient) {
			throw initialError;
		}

		return action(recoveredClient);
	}
};
