import {
	EventTimeline,
	type MatrixClient,
	type MatrixEvent,
	type Room
} from 'matrix-js-sdk';
import {
	CryptoEvent,
	DecryptionFailureCode
} from 'matrix-js-sdk/lib/crypto-api';

/**
 * Failures the SDK gives up on for good: it refused to decrypt because it did
 * not (yet) trust the sender's device, not because a key was missing. Rust
 * crypto removes these events from its pending list, so a later device-list
 * or cross-signing update never re-decrypts them. They only occur with
 * invisible crypto (`OnlySignedDevicesIsolationMode`, #438).
 *
 * Missing-key failures are deliberately absent: the SDK keeps them pending and
 * retries them itself when the key arrives (to-device, backup, import).
 */
const SENDER_TRUST_FAILURES: ReadonlySet<string> = new Set([
	DecryptionFailureCode.UNKNOWN_SENDER_DEVICE,
	DecryptionFailureCode.UNSIGNED_SENDER_DEVICE,
	DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED
]);

const RETRY_DEBOUNCE_MS = 250;

/** Every event of a room the client holds: the live timeline and all backfilled neighbours. */
export const collectLoadedRoomEvents = (room: Room): MatrixEvent[] => {
	const events: MatrixEvent[] = [];
	let timeline = room.getLiveTimeline?.() || null;
	while (timeline) {
		events.unshift(...(timeline.getEvents?.() || []));
		timeline =
			timeline.getNeighbouringTimeline?.(EventTimeline.BACKWARDS) || null;
	}
	return events;
};

const isRetriableFailure = (event: MatrixEvent): boolean =>
	event.isEncrypted?.() === true &&
	event.isDecryptionFailure?.() === true &&
	typeof event.attemptDecryption === 'function';

/**
 * Re-decrypts the failed events of one room.
 *
 * `attemptDecryption({ isRetry: true })` is the only retry path for a FAILED
 * event: its clear event already holds the m.bad.encrypted placeholder, so
 * `decryptEventIfNeeded()` is a no-op for it. A success emits
 * `Event.decrypted`, which the chat views listen for to re-render.
 */
export const retryRoomDecryptionFailures = async (
	client: MatrixClient,
	roomId: string,
	filter: (event: MatrixEvent) => boolean = () => true
): Promise<{ attempted: number; rejected: number }> => {
	const crypto = client.getCrypto?.();
	const room = client.getRoom?.(roomId);
	if (!crypto || !room) return { attempted: 0, rejected: 0 };
	const failed = collectLoadedRoomEvents(room).filter(
		(event) => isRetriableFailure(event) && filter(event)
	);
	if (failed.length === 0) return { attempted: 0, rejected: 0 };
	// CryptoApi and CryptoBackend are the same rust-crypto object at runtime;
	// the SDK only exposes the narrower type via getCrypto().
	const backend = crypto as unknown as Parameters<
		MatrixEvent['attemptDecryption']
	>[0];
	const results = await Promise.allSettled(
		failed.map((event) =>
			event.attemptDecryption(backend, { isRetry: true })
		)
	);
	return {
		attempted: failed.length,
		rejected: results.filter((result) => result.status === 'rejected')
			.length
	};
};

/**
 * Re-decrypts messages the SDK refused because it did not yet know or trust
 * the sender's device, as soon as that device information changes (#69 /
 * FE#1827). Without it a reload shows the peer's history as "Nachricht
 * verschlüsselt" whenever the first decrypt ran before the device-list query,
 * and messages from a device that finished its recovery a moment later never
 * become readable in the open chat.
 */
export class MatrixDecryptionRetry {
	private client: MatrixClient | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	/** null = every sender. */
	private pendingSenders: Set<string> | null = new Set();

	public initialize(client: MatrixClient): void {
		if (this.client === client) return;
		this.detach();
		this.client = client;
		(client as any).on?.(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
		(client as any).on?.(
			CryptoEvent.UserTrustStatusChanged,
			this.onUserTrustChanged
		);
		(client as any).on?.(CryptoEvent.KeysChanged, this.onOwnKeysChanged);
		// Device lists may have been fetched before this listener attached.
		this.schedule(null);
	}

	public detach(): void {
		const client = this.client as any;
		client?.off?.(CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
		client?.off?.(
			CryptoEvent.UserTrustStatusChanged,
			this.onUserTrustChanged
		);
		client?.off?.(CryptoEvent.KeysChanged, this.onOwnKeysChanged);
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.pendingSenders = new Set();
		this.client = null;
	}

	private onDevicesUpdated = (userIds: string[]): void =>
		this.schedule(Array.isArray(userIds) ? userIds : null);

	private onUserTrustChanged = (userId: string): void =>
		this.schedule(typeof userId === 'string' ? [userId] : null);

	private onOwnKeysChanged = (): void => {
		const ownUserId = this.client?.getUserId?.();
		this.schedule(ownUserId ? [ownUserId] : null);
	};

	private schedule(userIds: string[] | null): void {
		if (!this.client) return;
		if (userIds === null) {
			this.pendingSenders = null;
		} else if (this.pendingSenders) {
			userIds.forEach((userId) => this.pendingSenders!.add(userId));
		}
		if (this.timer !== null) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			const senders = this.pendingSenders;
			this.pendingSenders = new Set();
			void this.retry(senders).catch(() => undefined);
		}, RETRY_DEBOUNCE_MS);
	}

	private async retry(senders: Set<string> | null): Promise<void> {
		const client = this.client;
		if (!client || senders?.size === 0) return;
		const rooms = client.getRooms?.() || [];
		await Promise.allSettled(
			rooms.map((room) =>
				retryRoomDecryptionFailures(
					client,
					room.roomId,
					(event) =>
						SENDER_TRUST_FAILURES.has(
							event.decryptionFailureReason as string
						) &&
						(senders === null ||
							senders.has(event.getSender?.() || ''))
				)
			)
		);
	}
}

export const matrixDecryptionRetry = new MatrixDecryptionRetry();
