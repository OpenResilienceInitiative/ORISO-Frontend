import { describe, expect, it, vi } from 'vitest';
import {
	EncryptionClientReadinessError,
	executeWithReadyEncryptionClient,
	resolveReadyEncryptionClient
} from './encryptionClient';

describe('resolveReadyEncryptionClient (#839)', () => {
	it('uses the recovered PREPARED service client for product crypto actions', async () => {
		const recoveredClient = { deviceId: 'DEVICE_TWO' };
		const getReadyClient = vi.fn().mockResolvedValue(recoveredClient);
		const getStaleDeviceRecoveryVersion = vi.fn().mockReturnValue(0);

		await expect(
			resolveReadyEncryptionClient(undefined, {
				getReadyClient,
				getStaleDeviceRecoveryVersion
			} as any)
		).resolves.toBe(recoveredClient);
		expect(getReadyClient).toHaveBeenCalledOnce();
	});

	it('keeps injected Storybook/test clients isolated from the registry', async () => {
		const override = { deviceId: 'STORYBOOK' };
		const getReadyClient = vi.fn();

		await expect(
			resolveReadyEncryptionClient(
				override as any,
				{
					getReadyClient
				} as any
			)
		).resolves.toBe(override);
		expect(getReadyClient).not.toHaveBeenCalled();
	});
});

describe('executeWithReadyEncryptionClient (#839)', () => {
	it('retries a failed crypto action once when stale-device recovery replaces the client', async () => {
		const staleClient = { deviceId: 'DEVICE_ONE' };
		const recoveredClient = { deviceId: 'DEVICE_TWO' };
		const getReadyClient = vi
			.fn()
			.mockResolvedValueOnce(staleClient)
			.mockResolvedValueOnce(recoveredClient);
		const getStaleDeviceRecoveryVersion = vi
			.fn()
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(1);
		const action = vi
			.fn()
			.mockRejectedValueOnce(new Error('stale OTK queue'))
			.mockResolvedValueOnce('recovery-key');

		await expect(
			executeWithReadyEncryptionClient(
				undefined,
				{ getReadyClient, getStaleDeviceRecoveryVersion } as any,
				action
			)
		).resolves.toBe('recovery-key');
		expect(action).toHaveBeenNthCalledWith(1, staleClient);
		expect(action).toHaveBeenNthCalledWith(2, recoveredClient);
	});

	it('preserves the original failure when the ready client was not replaced', async () => {
		const client = { deviceId: 'DEVICE_ONE' };
		const getReadyClient = vi.fn().mockResolvedValue(client);
		const getStaleDeviceRecoveryVersion = vi.fn().mockReturnValue(0);
		const failure = new Error('setup rejected');
		const action = vi.fn().mockRejectedValue(failure);

		await expect(
			executeWithReadyEncryptionClient(
				undefined,
				{ getReadyClient, getStaleDeviceRecoveryVersion } as any,
				action
			)
		).rejects.toBe(failure);
		expect(action).toHaveBeenCalledOnce();
	});

	it('classifies replacement readiness failures without exposing their details', async () => {
		const staleClient = { deviceId: 'DEVICE_ONE' };
		const getReadyClient = vi
			.fn()
			.mockResolvedValueOnce(staleClient)
			.mockRejectedValueOnce(new Error('sensitive sync details'));
		const action = vi.fn().mockRejectedValue(new Error('stale action'));
		const getStaleDeviceRecoveryVersion = vi.fn().mockReturnValue(0);

		const failure = await executeWithReadyEncryptionClient(
			undefined,
			{ getReadyClient, getStaleDeviceRecoveryVersion } as any,
			action
		).catch((error) => error);

		expect(failure).toBeInstanceOf(EncryptionClientReadinessError);
		expect(failure.stage).toBe('replacement-readiness');
		expect(failure.message).not.toContain('sensitive sync details');
	});

	it('does not retry when an unrelated client replacement follows an action failure', async () => {
		const initialClient = { deviceId: 'DEVICE_ONE' };
		const unrelatedClient = { deviceId: 'DEVICE_OTHER' };
		const getReadyClient = vi
			.fn()
			.mockResolvedValueOnce(initialClient)
			.mockResolvedValueOnce(unrelatedClient);
		const getStaleDeviceRecoveryVersion = vi.fn().mockReturnValue(0);
		const failure = new Error('ordinary setup failure');
		const action = vi.fn().mockRejectedValue(failure);

		await expect(
			executeWithReadyEncryptionClient(
				undefined,
				{ getReadyClient, getStaleDeviceRecoveryVersion } as any,
				action
			)
		).rejects.toBe(failure);
		expect(action).toHaveBeenCalledOnce();
	});
});
