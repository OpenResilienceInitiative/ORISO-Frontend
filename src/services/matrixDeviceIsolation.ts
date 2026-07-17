import type { MatrixClient } from 'matrix-js-sdk';
import {
	AllDevicesIsolationMode,
	OnlySignedDevicesIsolationMode
} from 'matrix-js-sdk/lib/crypto-api';

/**
 * #438 MSC4153 "invisible crypto". When enabled, the SDK shares Megolm keys
 * only with cross-signed devices (`OnlySignedDevicesIsolationMode`): an
 * unverified device (e.g. an attacker who logged in with a stolen password)
 * receives no keys and sees only undecryptable noise — device hygiene enforced
 * at the protocol level, no dismissable warning banners.
 *
 * When disabled we set the SDK default (`AllDevicesIsolationMode(false)` —
 * share to all, don't hard-fail on unverified devices) explicitly, so toggling
 * the flag off at runtime restores prior behaviour.
 *
 * The isolation itself is implemented by matrix-js-sdk (Apache-2.0); we only
 * choose the mode behind the `enableInvisibleCrypto` release toggle. Hard
 * depends on #437 key-backup/recovery so legitimate users can verify a new
 * device instead of locking themselves out.
 *
 * Best-effort: must be called after `initRustCrypto`; a failure here must never
 * break client startup.
 *
 * @returns true if a mode was applied, false if the client had no crypto.
 */
export const applyDeviceIsolationMode = (
	client: MatrixClient,
	invisibleCryptoEnabled: boolean
): boolean => {
	const crypto = client.getCrypto?.();
	if (!crypto) {
		return false;
	}
	try {
		crypto.setDeviceIsolationMode(
			invisibleCryptoEnabled
				? new OnlySignedDevicesIsolationMode()
				: new AllDevicesIsolationMode(false)
		);
		return true;
	} catch {
		// Only supported by the rust crypto stack; never break startup on it.
		return false;
	}
};
