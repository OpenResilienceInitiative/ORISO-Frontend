import { describe, expect, it, vi } from 'vitest';
import { resolveReadyEncryptionClient } from './encryptionClient';

describe('resolveReadyEncryptionClient (#839)', () => {
	it('uses the recovered PREPARED service client for product crypto actions', async () => {
		const recoveredClient = { deviceId: 'DEVICE_TWO' };
		const getReadyClient = vi.fn().mockResolvedValue(recoveredClient);

		await expect(
			resolveReadyEncryptionClient(undefined, { getReadyClient } as any)
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
