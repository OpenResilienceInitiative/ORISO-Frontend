import { describe, expect, it } from 'vitest';
import { buildMatrixCryptoStorePrefix } from './matrixCrypto';

describe('buildMatrixCryptoStorePrefix', () => {
	it('returns a deterministic and storage-safe prefix per Matrix device', () => {
		const first = buildMatrixCryptoStorePrefix(
			'@alice:matrix.localhost',
			'DEVICE/ONE'
		);
		const repeated = buildMatrixCryptoStorePrefix(
			'@alice:matrix.localhost',
			'DEVICE/ONE'
		);
		const secondDevice = buildMatrixCryptoStorePrefix(
			'@alice:matrix.localhost',
			'DEVICE:TWO'
		);

		expect(first).toBe(repeated);
		expect(first).not.toBe(secondDevice);
		expect(first).toMatch(/^oriso-matrix-[a-f0-9]+-[a-f0-9]+$/);
	});

	it.each([
		['', 'DEVICE_ONE'],
		['@alice:matrix.localhost', ''],
		[' @alice:matrix.localhost', 'DEVICE_ONE'],
		['@alice:matrix.localhost ', 'DEVICE_ONE'],
		['@alice:matrix.localhost', ' DEVICE_ONE'],
		['@alice:matrix.localhost', 'DEVICE_ONE ']
	])(
		'rejects a missing or padded Matrix user or device identity',
		(userId, deviceId) => {
			expect(() =>
				buildMatrixCryptoStorePrefix(userId, deviceId)
			).toThrow(
				'Matrix user ID and device ID are required for the crypto store'
			);
		}
	);
});
