import { initializeChatRecovery } from '../../services/authenticatedChatRecovery';
import { loadPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';
import { recoverWithKey } from '../../services/matrixKeyBackupService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
	beforeEach(() => vi.clearAllMocks());
	it('does not load or recover keys while another setup holds the lock', async () => {
		const client = { getUserId: () => '@guest:example.test' } as never;
		vi.mocked(initializeChatRecovery).mockResolvedValue('busy');
		await expect(prepareGuestRecovery(client)).rejects.toThrow('busy');
		expect(loadPendingRecoveryKey).not.toHaveBeenCalled();
		expect(recoverWithKey).not.toHaveBeenCalled();
	});
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
