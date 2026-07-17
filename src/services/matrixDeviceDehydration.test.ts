import { describe, expect, it, vi } from 'vitest';
import { startDeviceDehydration } from './matrixDeviceDehydration';

/**
 * #439 MSC3814 dehydrated devices. The SDK (Apache-2.0) does the dehydration
 * itself; we only decide when to start it and guard the preconditions.
 */

const buildCrypto = (overrides: Record<string, unknown> = {}) => ({
	isDehydrationSupported: vi.fn().mockResolvedValue(true),
	isSecretStorageReady: vi.fn().mockResolvedValue(true),
	startDehydration: vi.fn().mockResolvedValue(undefined),
	...overrides
});

const buildClient = (crypto: unknown) => ({ getCrypto: () => crypto }) as any;

describe('startDeviceDehydration (#439)', () => {
	it('rehydrates and (re)creates the dehydrated device when enabled, supported and secret storage is ready', async () => {
		const crypto = buildCrypto();
		const result = await startDeviceDehydration(buildClient(crypto), true);

		expect(result).toBe('started');
		// rehydrate:true reads the accumulated to-device keys from the parked
		// device before a fresh one is created + periodic rotation scheduled.
		expect(crypto.startDehydration).toHaveBeenCalledWith({
			rehydrate: true
		});
	});

	it('is a no-op when the toggle is off', async () => {
		const crypto = buildCrypto();
		const result = await startDeviceDehydration(buildClient(crypto), false);

		expect(result).toBe('disabled');
		expect(crypto.isDehydrationSupported).not.toHaveBeenCalled();
		expect(crypto.startDehydration).not.toHaveBeenCalled();
	});

	it('skips when the server/backend does not support MSC3814', async () => {
		const crypto = buildCrypto({
			isDehydrationSupported: vi.fn().mockResolvedValue(false)
		});
		const result = await startDeviceDehydration(buildClient(crypto), true);

		expect(result).toBe('unsupported');
		expect(crypto.startDehydration).not.toHaveBeenCalled();
	});

	it('skips when secret storage is not ready (the dehydration key lives in 4S)', async () => {
		const crypto = buildCrypto({
			isSecretStorageReady: vi.fn().mockResolvedValue(false)
		});
		const result = await startDeviceDehydration(buildClient(crypto), true);

		expect(result).toBe('not-ready');
		expect(crypto.startDehydration).not.toHaveBeenCalled();
	});

	it('returns no-crypto when the client has no crypto', async () => {
		expect(await startDeviceDehydration(buildClient(null), true)).toBe(
			'no-crypto'
		);
		expect(await startDeviceDehydration({} as any, true)).toBe('no-crypto');
	});

	it('never throws if the SDK call fails (best-effort)', async () => {
		const crypto = buildCrypto({
			startDehydration: vi.fn().mockRejectedValue(new Error('rust boom'))
		});
		await expect(
			startDeviceDehydration(buildClient(crypto), true)
		).resolves.toBe('error');
	});
});
