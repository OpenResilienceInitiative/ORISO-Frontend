import { initializeChatRecovery } from '../../services/authenticatedChatRecovery';
import { loadPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';
import { recoverWithKey } from '../../services/matrixKeyBackupService';
import { describe, expect, it, vi } from 'vitest';
import { prepareGuestRecovery } from './prepareGuestRecovery';

vi.mock('../../services/authenticatedChatRecovery', () => ({
	initializeChatRecovery: vi.fn()
}));
vi.mock('../../services/pendingRecoveryKeyStore', () => ({
	loadPendingRecoveryKey: vi.fn()
}));
vi.mock('../../services/matrixKeyBackupService', () => ({
	recoverWithKey: vi.fn()
}));

describe('prepare guest recovery', () => {
	it('verifies the existing key without replacing the user identity', async () => {
		const client = { getUserId: () => '@guest:example.test' } as never;
		vi.mocked(initializeChatRecovery).mockResolvedValue('ready');
		vi.mocked(loadPendingRecoveryKey).mockResolvedValue('synthetic-key');
		vi.mocked(recoverWithKey).mockResolvedValue({ imported: 2, total: 2 });
		await expect(prepareGuestRecovery(client)).resolves.toBe(
			'synthetic-key'
		);
		expect(recoverWithKey).toHaveBeenCalledWith(client, 'synthetic-key');
	});
	it('fails closed when the existing recovery key is not available', async () => {
		const client = { getUserId: () => '@guest:example.test' } as never;
		vi.mocked(initializeChatRecovery).mockResolvedValue(
			'needs-recovery-key'
		);
		vi.mocked(loadPendingRecoveryKey).mockResolvedValue(null);
		await expect(prepareGuestRecovery(client)).rejects.toThrow(
			'recovery key'
		);
	});
});
