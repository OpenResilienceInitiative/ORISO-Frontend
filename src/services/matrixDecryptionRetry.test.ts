import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	CryptoEvent,
	DecryptionFailureCode
} from 'matrix-js-sdk/lib/crypto-api';
import {
	MatrixDecryptionRetry,
	collectLoadedRoomEvents,
	retryRoomDecryptionFailures
} from './matrixDecryptionRetry';

type Listener = (...args: any[]) => void;

const failedEvent = (
	sender: string,
	reason: DecryptionFailureCode | null = DecryptionFailureCode.UNSIGNED_SENDER_DEVICE
) => ({
	getSender: () => sender,
	isEncrypted: () => true,
	isDecryptionFailure: () => true,
	decryptionFailureReason: reason,
	attemptDecryption: vi.fn().mockResolvedValue(undefined)
});

const clearEvent = () => ({
	getSender: () => '@peer:test',
	isEncrypted: () => true,
	isDecryptionFailure: () => false,
	decryptionFailureReason: null,
	attemptDecryption: vi.fn()
});

const timeline = (events: any[], previous: any = null) => ({
	getEvents: () => events,
	getNeighbouringTimeline: () => previous
});

const room = (roomId: string, live: any) => ({
	roomId,
	getLiveTimeline: () => live
});

const fakeClient = (rooms: any[]) => {
	const listeners = new Map<string, Set<Listener>>();
	const crypto = { id: 'crypto' };
	return {
		crypto,
		getCrypto: () => crypto,
		getRooms: () => rooms,
		getRoom: (id: string) => rooms.find((r) => r.roomId === id) ?? null,
		on: (name: string, listener: Listener) => {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(listener);
		},
		off: (name: string, listener: Listener) =>
			listeners.get(name)?.delete(listener),
		emit: (name: string, ...args: any[]) =>
			listeners.get(name)?.forEach((listener) => listener(...args)),
		listenerCount: (name: string) => listeners.get(name)?.size ?? 0
	};
};

describe('collectLoadedRoomEvents', () => {
	it('walks the live timeline and every backfilled neighbour, oldest first', () => {
		const older = { id: 'older' };
		const newer = { id: 'newer' };
		const live = timeline([newer], timeline([older]));
		expect(collectLoadedRoomEvents(room('!r:test', live) as any)).toEqual([
			older,
			newer
		]);
	});
});

describe('retryRoomDecryptionFailures', () => {
	it('retries only failed events and leaves decrypted ones alone', async () => {
		const failed = failedEvent('@peer:test');
		const fine = clearEvent();
		const client = fakeClient([room('!r:test', timeline([failed, fine]))]);

		const result = await retryRoomDecryptionFailures(
			client as any,
			'!r:test'
		);

		expect(failed.attemptDecryption).toHaveBeenCalledWith(client.crypto, {
			isRetry: true
		});
		expect(fine.attemptDecryption).not.toHaveBeenCalled();
		expect(result).toEqual({ attempted: 1, rejected: 0 });
	});

	it('applies an optional filter', async () => {
		const peer = failedEvent('@peer:test');
		const other = failedEvent('@other:test');
		const client = fakeClient([room('!r:test', timeline([peer, other]))]);

		await retryRoomDecryptionFailures(
			client as any,
			'!r:test',
			(event) => event.getSender() === '@peer:test'
		);

		expect(peer.attemptDecryption).toHaveBeenCalledOnce();
		expect(other.attemptDecryption).not.toHaveBeenCalled();
	});
});

/**
 * With invisible crypto (OnlySignedDevicesIsolationMode) the SDK refuses to
 * decrypt a message while the sender's device is unknown or not yet
 * cross-signed — e.g. right after a reload, before the first /keys/query, or
 * while the sender's fresh device is still finishing its recovery. The SDK
 * drops such events from its retry list, so without our retry they stay
 * "Nachricht verschlüsselt" for good.
 */
describe('MatrixDecryptionRetry', () => {
	let retry: MatrixDecryptionRetry;

	beforeEach(() => {
		vi.useFakeTimers();
		retry = new MatrixDecryptionRetry();
	});

	afterEach(() => {
		retry.detach();
		vi.useRealTimers();
	});

	it.each([
		DecryptionFailureCode.UNKNOWN_SENDER_DEVICE,
		DecryptionFailureCode.UNSIGNED_SENDER_DEVICE,
		DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED
	])(
		'retries a %s failure once the sender’s devices are updated',
		async (reason) => {
			const failed = failedEvent('@peer:test', reason);
			const client = fakeClient([room('!r:test', timeline([failed]))]);
			retry.initialize(client as any);
			await vi.runAllTimersAsync();
			failed.attemptDecryption.mockClear();

			client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
			await vi.runAllTimersAsync();

			expect(failed.attemptDecryption).toHaveBeenCalledWith(
				client.crypto,
				{ isRetry: true }
			);
		}
	);

	it('retries when the sender’s identity trust changes', async () => {
		const failed = failedEvent('@peer:test');
		const client = fakeClient([room('!r:test', timeline([failed]))]);
		retry.initialize(client as any);
		await vi.runAllTimersAsync();
		failed.attemptDecryption.mockClear();

		client.emit(CryptoEvent.UserTrustStatusChanged, '@peer:test', {});
		await vi.runAllTimersAsync();

		expect(failed.attemptDecryption).toHaveBeenCalledOnce();
	});

	it('sweeps once on initialize for updates that landed before it attached', async () => {
		const failed = failedEvent('@peer:test');
		const client = fakeClient([room('!r:test', timeline([failed]))]);

		retry.initialize(client as any);
		await vi.runAllTimersAsync();

		expect(failed.attemptDecryption).toHaveBeenCalledOnce();
	});

	it('leaves missing-key failures to the SDK, which retries them when the key arrives', async () => {
		const missingKey = failedEvent(
			'@peer:test',
			DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
		);
		const client = fakeClient([room('!r:test', timeline([missingKey]))]);
		retry.initialize(client as any);
		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		await vi.runAllTimersAsync();

		expect(missingKey.attemptDecryption).not.toHaveBeenCalled();
	});

	it('only retries events of the users whose devices changed', async () => {
		const peer = failedEvent('@peer:test');
		const other = failedEvent('@other:test');
		const client = fakeClient([room('!r:test', timeline([peer, other]))]);
		retry.initialize(client as any);
		await vi.runAllTimersAsync();
		peer.attemptDecryption.mockClear();
		other.attemptDecryption.mockClear();

		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		await vi.runAllTimersAsync();

		expect(peer.attemptDecryption).toHaveBeenCalledOnce();
		expect(other.attemptDecryption).not.toHaveBeenCalled();
	});

	it('coalesces a burst of updates into one retry pass', async () => {
		const failed = failedEvent('@peer:test');
		const client = fakeClient([room('!r:test', timeline([failed]))]);
		retry.initialize(client as any);
		await vi.runAllTimersAsync();
		failed.attemptDecryption.mockClear();

		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		client.emit(CryptoEvent.UserTrustStatusChanged, '@peer:test', {});
		await vi.runAllTimersAsync();

		expect(failed.attemptDecryption).toHaveBeenCalledOnce();
	});

	it('stops listening and drops a pending pass on detach', async () => {
		const failed = failedEvent('@peer:test');
		const client = fakeClient([room('!r:test', timeline([failed]))]);
		retry.initialize(client as any);
		await vi.runAllTimersAsync();
		failed.attemptDecryption.mockClear();

		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		retry.detach();
		await vi.runAllTimersAsync();

		expect(failed.attemptDecryption).not.toHaveBeenCalled();
		expect(client.listenerCount(CryptoEvent.DevicesUpdated)).toBe(0);
		expect(client.listenerCount(CryptoEvent.UserTrustStatusChanged)).toBe(
			0
		);
	});

	it('never throws into the SDK callback when a retry rejects', async () => {
		const failed = failedEvent('@peer:test');
		failed.attemptDecryption.mockRejectedValue(new Error('still no key'));
		const client = fakeClient([room('!r:test', timeline([failed]))]);

		retry.initialize(client as any);
		client.emit(CryptoEvent.DevicesUpdated, ['@peer:test'], false);
		await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
	});
});
