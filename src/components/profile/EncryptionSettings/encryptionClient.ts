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
