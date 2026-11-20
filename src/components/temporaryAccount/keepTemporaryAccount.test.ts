import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { keepTemporaryAccount } from './keepTemporaryAccount';
import { apiKeepTemporaryAccount } from '../../api/apiKeepTemporaryAccount';
import { loadPendingRecoveryKey } from '../../services/pendingRecoveryKeyStore';
import { sealRecoveryKeyUnderPassword } from '../../services/passwordRecoveryEnrollment';
import { getMatrixClientService } from '../../services/matrixClientRegistry';

vi.mock('../../api/apiKeepTemporaryAccount', () => ({
	apiKeepTemporaryAccount: vi.fn()
}));
vi.mock('../../services/pendingRecoveryKeyStore', () => ({
	loadPendingRecoveryKey: vi.fn()
}));
vi.mock('../../services/passwordRecoveryEnrollment', () => ({
	sealRecoveryKeyUnderPassword: vi.fn()
}));
vi.mock('../../services/matrixClientRegistry', () => ({
	getMatrixClientService: vi.fn()
}));

const client = { getUserId: () => '@guest:oriso' };
const PASSWORD = 'Sonnenblume-2026-lang';
const passwordRecovery = {
	chatRecoveryMode: 'LOGIN_PASSWORD' as const,
	chatRecoveryPolicyRevision: 3
};

describe('keep a temporary account (UserService#1662)', () => {
	beforeEach(() => {
		vi.mocked(apiKeepTemporaryAccount).mockReset().mockResolvedValue({});
		vi.mocked(loadPendingRecoveryKey).mockReset();
		vi.mocked(sealRecoveryKeyUnderPassword)
			.mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(getMatrixClientService)
			.mockReset()
			.mockReturnValue({ getReadyClient: async () => client } as any);
	});

	it('only keeps the account where the recovery key is the way back', async () => {
		await expect(
			keepTemporaryAccount(PASSWORD, { chatRecoveryMode: 'RECOVERY_KEY' })
		).resolves.toBe('kept');
		expect(apiKeepTemporaryAccount).toHaveBeenCalledWith(PASSWORD);
		expect(sealRecoveryKeyUnderPassword).not.toHaveBeenCalled();
	});

	it('seals the parked recovery key under the new password', async () => {
		vi.mocked(loadPendingRecoveryKey).mockResolvedValue('EsTc key');
		await expect(
			keepTemporaryAccount(PASSWORD, passwordRecovery)
		).resolves.toBe('kept');
		expect(loadPendingRecoveryKey).toHaveBeenCalledWith('@guest:oriso');
		expect(sealRecoveryKeyUnderPassword).toHaveBeenCalledWith(
			client,
			'@guest:oriso',
			PASSWORD,
			'EsTc key',
			3
		);
	});

	it('reports a pending recovery when no recovery key is parked on this device', async () => {
		vi.mocked(loadPendingRecoveryKey).mockResolvedValue(null);
		await expect(
			keepTemporaryAccount(PASSWORD, passwordRecovery)
		).resolves.toBe('recoveryPending');
		expect(sealRecoveryKeyUnderPassword).not.toHaveBeenCalled();
	});

	it('reports a pending recovery when the chat is not ready or sealing fails', async () => {
		vi.mocked(getMatrixClientService).mockReturnValue(undefined as any);
		await expect(
			keepTemporaryAccount(PASSWORD, passwordRecovery)
		).resolves.toBe('recoveryPending');

		vi.mocked(getMatrixClientService).mockReturnValue({
			getReadyClient: async () => client
		} as any);
		vi.mocked(loadPendingRecoveryKey).mockResolvedValue('EsTc key');
		vi.mocked(sealRecoveryKeyUnderPassword).mockRejectedValue(
			new Error('work limit')
		);
		await expect(
			keepTemporaryAccount(PASSWORD, passwordRecovery)
		).resolves.toBe('recoveryPending');
	});

	it('does not touch the recovery when the server refuses', async () => {
		vi.mocked(apiKeepTemporaryAccount).mockRejectedValue(
			new Error('FORBIDDEN')
		);
		await expect(
			keepTemporaryAccount(PASSWORD, passwordRecovery)
		).rejects.toThrow('FORBIDDEN');
		expect(loadPendingRecoveryKey).not.toHaveBeenCalled();
	});
});
