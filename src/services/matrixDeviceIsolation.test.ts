import { describe, expect, it, vi } from 'vitest';
import { DeviceIsolationModeKind } from 'matrix-js-sdk/lib/crypto-api';
import { applyDeviceIsolationMode } from './matrixDeviceIsolation';

/**
 * #438 MSC4153 invisible crypto — device isolation mode helper. The SDK
 * (Apache-2.0) implements the isolation itself; we only choose the mode
 * behind the release toggle.
 */

const buildClient = (crypto: unknown) => ({ getCrypto: () => crypto }) as any;

describe('applyDeviceIsolationMode (#438)', () => {
	it('sets OnlySignedDevicesIsolationMode when invisible crypto is enabled', () => {
		const setDeviceIsolationMode = vi.fn();
		const applied = applyDeviceIsolationMode(
			buildClient({ setDeviceIsolationMode }),
			true
		);

		expect(applied).toBe(true);
		expect(setDeviceIsolationMode).toHaveBeenCalledTimes(1);
		expect(setDeviceIsolationMode.mock.calls[0][0].kind).toBe(
			DeviceIsolationModeKind.OnlySignedDevicesIsolationMode
		);
	});

	it('sets AllDevicesIsolationMode (non-erroring) when disabled', () => {
		const setDeviceIsolationMode = vi.fn();
		const applied = applyDeviceIsolationMode(
			buildClient({ setDeviceIsolationMode }),
			false
		);

		expect(applied).toBe(true);
		expect(setDeviceIsolationMode.mock.calls[0][0].kind).toBe(
			DeviceIsolationModeKind.AllDevicesIsolationMode
		);
	});

	it('is a no-op that returns false when the client has no crypto', () => {
		expect(applyDeviceIsolationMode(buildClient(null), true)).toBe(false);
	});

	it('is a no-op when the client exposes no getCrypto method', () => {
		expect(applyDeviceIsolationMode({} as any, true)).toBe(false);
	});

	it('never throws if the SDK call fails (best-effort)', () => {
		const setDeviceIsolationMode = vi.fn(() => {
			throw new Error('rust boom');
		});
		expect(() =>
			applyDeviceIsolationMode(
				buildClient({ setDeviceIsolationMode }),
				true
			)
		).not.toThrow();
	});
});
