import type { MatrixClient } from 'matrix-js-sdk';
import type { MatrixClientService } from '../../../services/matrixClientService';

type ReadyMatrixClientService = Pick<
	MatrixClientService,
	'getReadyClient' | 'getStaleDeviceRecoveryVersion'
>;

export type EncryptionClientReadinessStage =
	| 'initial-readiness'
	| 'replacement-readiness';

export class EncryptionClientReadinessError extends Error {
	constructor(
		public readonly stage: EncryptionClientReadinessStage,
		cause: unknown
	) {
		super(`Encryption client failed during ${stage}`, { cause });
		this.name = 'EncryptionClientReadinessError';
	}
}

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
	let initialClient: MatrixClient | null;
	try {
		initialClient = await resolveReadyEncryptionClient(
			clientOverride,
			service
		);
	} catch (error) {
		throw new EncryptionClientReadinessError('initial-readiness', error);
	}
	if (!initialClient) {
		return null;
	}
	const recoveryVersion = service?.getStaleDeviceRecoveryVersion() ?? 0;

	try {
		return await action(initialClient);
	} catch (initialError) {
		if (clientOverride !== undefined || !service) {
			throw initialError;
		}

		let recoveredClient: MatrixClient;
		try {
			recoveredClient = await service.getReadyClient();
		} catch (error) {
			throw new EncryptionClientReadinessError(
				'replacement-readiness',
				error
			);
		}
		if (recoveredClient === initialClient) {
			throw initialError;
		}
		if (service.getStaleDeviceRecoveryVersion() <= recoveryVersion) {
			throw initialError;
		}

		return action(recoveredClient);
	}
};
