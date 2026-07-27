import type { MatrixClient } from 'matrix-js-sdk';

export type DeviceDehydrationResult =
	| 'started'
	| 'disabled'
	| 'unsupported'
	| 'not-ready'
	| 'no-crypto'
	| 'error';

/**
 * #439 MSC3814 "dehydrated devices". A dehydrated device is a sleeping
 * pseudo-device parked server-side; its secret sits in secret storage behind
 * the recovery key, so the server cannot read it. Senders encrypt Megolm room
 * keys to it like to any device, so messages sent while the user has no active
 * device are still delivered to it. On the next real login the client
 * *rehydrates* it — reads the accumulated to-device messages (the room keys)
 * and the whole offline gap becomes readable — then parks a fresh one.
 *
 * This matters because our clients' normal pattern is weeks-long login pauses:
 * without dehydration, everything sent during a gap is permanently
 * undecryptable after the Megolm cutover.
 *
 * `startDehydration({ rehydrate: true })` does the whole cycle in one call:
 * rehydrate the existing device, create a new dehydration key if needed
 * (stored in secret storage), create a fresh dehydrated device, and schedule
 * periodic re-creation. It must only run once cross-signing + secret storage
 * are set up (the dehydration key lives in 4S), and only when the server
 * supports MSC3814 — hence the two guards.
 *
 * The dehydration itself is matrix-js-sdk (Apache-2.0); we only choose when to
 * start it, behind the `enableDeviceDehydration` release toggle. Hard-depends
 * on #437 key backup / secret storage. Best-effort: must never break login.
 *
 * @returns what happened, for logging/telemetry — never throws.
 */
export const startDeviceDehydration = async (
	client: MatrixClient,
	enabled: boolean
): Promise<DeviceDehydrationResult> => {
	if (!enabled) {
		return 'disabled';
	}
	const crypto = client.getCrypto?.();
	if (!crypto) {
		return 'no-crypto';
	}
	try {
		if (!(await crypto.isDehydrationSupported())) {
			return 'unsupported';
		}
		// The dehydration key is stored in secret storage; without 4S set up
		// (i.e. before the user has completed recovery setup) we can't start.
		if (!(await crypto.isSecretStorageReady())) {
			return 'not-ready';
		}
		await crypto.startDehydration({ rehydrate: true });
		return 'started';
	} catch {
		return 'error';
	}
};
