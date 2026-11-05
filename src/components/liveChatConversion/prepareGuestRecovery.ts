import type { MatrixClient } from 'matrix-js-sdk';
import { initializeChatRecovery } from '../../services/authenticatedChatRecovery';
import { recoverWithKey } from '../../services/matrixKeyBackupService';
import { loadPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';

/** Never replace an existing root: prove the same key can open this account's backup. */
export const prepareGuestRecovery = async (
	client: MatrixClient,
	suppliedKey?: string
): Promise<string> => {
	const userId = client.getUserId();
	if (!userId) throw new Error('Matrix account is not ready');
	const state = await initializeChatRecovery(
		client,
		{ mode: 'RECOVERY_KEY' },
		null
	);
	if (state === 'busy') throw new Error('Recovery setup is busy');
	const key = suppliedKey?.trim() || (await loadPendingRecoveryKey(userId));
	if (!key) throw new Error('The existing recovery key is required');
	await recoverWithKey(client, key);
	if (client.getUserId() !== userId)
		throw new Error('Matrix account changed');
	return key;
};
