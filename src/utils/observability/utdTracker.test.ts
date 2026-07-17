// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecryptionFailureCode } from 'matrix-js-sdk/lib/crypto-api';

// vi.mock factories are hoisted above imports, so referenced variables must
// be prefixed with "mock" (Vitest's hoisting convention) -- see
// https://vitest.dev/api/vi.html#vi-mock
const mockAdd = vi.fn();
const mockCreateCounter = vi.fn(() => ({ add: mockAdd }));
const mockGetMeter = vi.fn(() => ({ createCounter: mockCreateCounter }));

vi.mock('@opentelemetry/api', () => ({
	metrics: { getMeter: mockGetMeter }
}));

const CLIENT_POLL_INTERVAL_MS = 2000;
const GRACE_PERIOD_MS = 5 * 60 * 1000;

type Listener = (...args: any[]) => void;

/**
 * Minimal Matrix client double: just enough EventEmitter surface for a
 * global 'Room.timeline' listener (no per-room filtering -- the tracker
 * must observe every room).
 */
const createFakeMatrixClient = () => {
	const listeners = new Map<string, Set<Listener>>();
	return {
		on: (event: string, listener: Listener) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set());
			}
			listeners.get(event)!.add(listener);
		},
		off: (event: string, listener: Listener) => {
			listeners.get(event)?.delete(listener);
		},
		emit: (event: string, ...args: any[]) => {
			listeners.get(event)?.forEach((listener) => listener(...args));
		},
		listenerCount: (event: string) => listeners.get(event)?.size || 0
	};
};

/**
 * Minimal MatrixEvent double for an `m.room.encrypted` event: enough surface
 * to drive `Event.decrypted` (success/failure) transitions the way
 * matrix-js-sdk does -- `getType()` stays `m.room.encrypted` on failure and
 * only changes on success.
 */
const createFakeEncryptedEvent = (id: string) => {
	const decryptionListeners = new Set<Listener>();
	let type = 'm.room.encrypted';
	let failing = false;
	let failureReason: DecryptionFailureCode | null = null;

	return {
		getId: () => id,
		getType: () => type,
		isDecryptionFailure: () => failing,
		get decryptionFailureReason() {
			return failureReason;
		},
		on: (name: string, listener: Listener) => {
			if (name === 'Event.decrypted') decryptionListeners.add(listener);
		},
		off: (name: string, listener: Listener) => {
			if (name === 'Event.decrypted')
				decryptionListeners.delete(listener);
		},
		listenerCount: () => decryptionListeners.size,
		simulateFailure: (reason: DecryptionFailureCode | null) => {
			type = 'm.room.encrypted';
			failing = true;
			failureReason = reason;
			decryptionListeners.forEach((listener) => listener());
		},
		simulateSuccess: () => {
			type = 'm.room.message';
			failing = false;
			decryptionListeners.forEach((listener) => listener());
		}
	};
};

/** Advances past one client-poll tick so a just-registered client gets picked up. */
const flushClientPoll = () => {
	vi.advanceTimersByTime(CLIENT_POLL_INTERVAL_MS);
};

/**
 * `vi.resetModules()` gives `./utdTracker` a fresh module instance per test
 * (so its `initialized` singleton flag and internal tracking Maps reset
 * too) -- but that means anything it imports internally (in particular
 * `matrixClientRegistry`, a stateful singleton) must be re-imported
 * *dynamically* from the same fresh registry, not statically at the top of
 * this file, or the test would be setting the client ref on a different
 * module instance than the one `utdTracker` reads from.
 */
const loadModules = async () => {
	const { initUtdTracking } = await import('./utdTracker');
	const { setMatrixClientServiceRef } = await import(
		'../../services/matrixClientRegistry'
	);
	return { initUtdTracking, setMatrixClientServiceRef };
};

describe('initUtdTracking', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('gets a meter named exactly "utd-tracker"', async () => {
		const { initUtdTracking } = await loadModules();

		initUtdTracking();

		expect(mockGetMeter).toHaveBeenCalledWith('utd-tracker');
	});

	it('creates a counter named exactly "decryption_failure"', async () => {
		const { initUtdTracking } = await loadModules();

		initUtdTracking();

		expect(mockCreateCounter).toHaveBeenCalledWith('decryption_failure');
	});

	it('only wires the meter/counter once even if called repeatedly', async () => {
		const { initUtdTracking } = await loadModules();

		initUtdTracking();
		initUtdTracking();
		initUtdTracking();

		expect(mockGetMeter).toHaveBeenCalledTimes(1);
		expect(mockCreateCounter).toHaveBeenCalledTimes(1);
	});

	it('never throws when the meter is unavailable', async () => {
		mockGetMeter.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		const { initUtdTracking } = await loadModules();

		expect(() => initUtdTracking()).not.toThrow();
	});

	describe('grace-period classification', () => {
		it('does not count a decryption failure that resolves before the grace period elapses', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);

			event.simulateFailure(
				DecryptionFailureCode.OLM_UNKNOWN_MESSAGE_INDEX
			);
			vi.advanceTimersByTime(GRACE_PERIOD_MS - 1000);
			event.simulateSuccess();
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).not.toHaveBeenCalledWith(
				1,
				expect.objectContaining({ outcome: 'permanent' })
			);
		});

		it('optionally counts a resolved-before-timeout failure as transient_resolved with the original cause', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);

			event.simulateFailure(
				DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			);
			event.simulateSuccess();

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'transient_resolved',
				cause: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			});
		});

		it('counts a decryption failure still unresolved after five minutes as permanent, with the right cause/category', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);

			event.simulateFailure(DecryptionFailureCode.UNKNOWN_SENDER_DEVICE);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: DecryptionFailureCode.UNKNOWN_SENDER_DEVICE,
				category: 'bug'
			});
		});

		it('does not increment a second time if the event resolves after already timing out', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);

			event.simulateFailure(DecryptionFailureCode.UNKNOWN_ERROR);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);
			expect(mockAdd).toHaveBeenCalledTimes(1);

			// The permanent-timeout path detaches the listener, so a later
			// success (if the SDK ever fired one) shouldn't be observed --
			// but even if it were, this must not add a second time.
			event.simulateSuccess();
			expect(mockAdd).toHaveBeenCalledTimes(1);
		});

		it('does not restart the grace timer on a repeated failure fire for the same event', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);

			event.simulateFailure(DecryptionFailureCode.UNKNOWN_ERROR);
			vi.advanceTimersByTime(GRACE_PERIOD_MS - 1000);
			// A second failure fire for the same still-pending event must not
			// push the deadline out further.
			event.simulateFailure(DecryptionFailureCode.UNKNOWN_ERROR);
			vi.advanceTimersByTime(1000);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: DecryptionFailureCode.UNKNOWN_ERROR,
				category: 'bug'
			});
		});

		it('ignores non-encrypted timeline events', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const plainEvent = {
				getId: () => '$plain1',
				getType: () => 'm.room.message',
				isDecryptionFailure: () => false,
				decryptionFailureReason: null,
				on: vi.fn(),
				off: vi.fn()
			};
			client.emit('Room.timeline', plainEvent);

			expect(plainEvent.on).not.toHaveBeenCalled();
			expect(mockAdd).not.toHaveBeenCalled();
		});
	});

	describe('category classification', () => {
		const withheldCodes = [
			DecryptionFailureCode.MEGOLM_KEY_WITHHELD,
			DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE
		];
		const bugCodes = Object.values(DecryptionFailureCode).filter(
			(code) => !withheldCodes.includes(code as DecryptionFailureCode)
		);

		it.each(withheldCodes)(
			'classifies %s as category "withheld"',
			async (code) => {
				const { initUtdTracking, setMatrixClientServiceRef } =
					await loadModules();
				initUtdTracking();

				const client = createFakeMatrixClient();
				setMatrixClientServiceRef({ getClient: () => client } as any);
				flushClientPoll();

				const event = createFakeEncryptedEvent(`$${code}`);
				client.emit('Room.timeline', event);
				event.simulateFailure(code);
				vi.advanceTimersByTime(GRACE_PERIOD_MS);

				expect(mockAdd).toHaveBeenCalledWith(1, {
					outcome: 'permanent',
					cause: code,
					category: 'withheld'
				});
			}
		);

		it.each(bugCodes)('classifies %s as category "bug"', async (code) => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent(`$${code}`);
			client.emit('Room.timeline', event);
			event.simulateFailure(code as DecryptionFailureCode);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: code,
				category: 'bug'
			});
		});

		it('classifies UNKNOWN_ERROR specifically as "bug"', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$unknown-error');
			client.emit('Room.timeline', event);
			event.simulateFailure(DecryptionFailureCode.UNKNOWN_ERROR);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: DecryptionFailureCode.UNKNOWN_ERROR,
				category: 'bug'
			});
		});

		it('falls back to UNKNOWN_ERROR (category "bug") when decryptionFailureReason is null', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt-null-reason');
			client.emit('Room.timeline', event);
			// isDecryptionFailure() true but decryptionFailureReason left null.
			event.simulateFailure(null);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: DecryptionFailureCode.UNKNOWN_ERROR,
				category: 'bug'
			});
		});
	});

	describe('no PII / identifying attributes', () => {
		it('attaches exactly {outcome, cause, category} for a permanent failure -- no event id, room id, sender, or user id', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);
			event.simulateFailure(
				DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP
			);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			const [, attributes] = mockAdd.mock.calls[0];
			expect(Object.keys(attributes).sort()).toEqual(
				['category', 'cause', 'outcome'].sort()
			);
		});

		it('attaches exactly {outcome, cause} for a transient_resolved failure -- no event id, room id, sender, or user id', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);
			event.simulateFailure(
				DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			);
			event.simulateSuccess();

			const [, attributes] = mockAdd.mock.calls[0];
			expect(Object.keys(attributes).sort()).toEqual(
				['cause', 'outcome'].sort()
			);
		});
	});

	describe('resilience', () => {
		it('never throws when the counter add fails', async () => {
			mockAdd.mockImplementationOnce(() => {
				throw new Error('export failed');
			});
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);
			event.simulateFailure(DecryptionFailureCode.UNKNOWN_ERROR);

			expect(() => vi.advanceTimersByTime(GRACE_PERIOD_MS)).not.toThrow();
		});

		it('detaches from the old client and attaches to the new one when the Matrix client instance changes', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const clientA = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => clientA } as any);
			flushClientPoll();
			expect(clientA.listenerCount('Room.timeline')).toBe(1);

			const clientB = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => clientB } as any);
			flushClientPoll();

			expect(clientA.listenerCount('Room.timeline')).toBe(0);
			expect(clientB.listenerCount('Room.timeline')).toBe(1);
		});

		it('does not double-track the same event id across repeated Room.timeline fires', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$evt1');
			client.emit('Room.timeline', event);
			client.emit('Room.timeline', event);
			client.emit('Room.timeline', event);

			expect(event.listenerCount()).toBe(1);
		});
	});

	// #440 task 5 — a named, executable guard for the incident that motivated
	// this tracker (#412): a Megolm key that arrives seconds late made messages
	// briefly undecryptable, then self-healed. That transient must NOT register
	// as a UTD, or the SigNoz signal drowns in false positives; but a key that
	// genuinely never arrives MUST register. The grace-period logic already
	// covers both, this pins it to the concrete incident narrative + timing.
	describe('#412 regression: delayed Megolm key self-heals within the grace period', () => {
		it('does not count a key that arrives ~30s late (well inside the 5-minute grace)', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$delayed-key');
			client.emit('Room.timeline', event);

			// #412 symptom: the inbound Megolm session isn't known yet.
			event.simulateFailure(
				DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			);
			// The key shows up 30 seconds later — the SDK re-decrypts and the
			// event type is promoted away from the encrypted envelope.
			vi.advanceTimersByTime(30 * 1000);
			event.simulateSuccess();
			// Let the full grace window elapse to prove the permanent timer was
			// cancelled, not merely not-yet-fired.
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).not.toHaveBeenCalledWith(
				1,
				expect.objectContaining({ outcome: 'permanent' })
			);
			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'transient_resolved',
				cause: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			});
		});

		it('still counts the evil twin — a key that never arrives — as a permanent bug', async () => {
			const { initUtdTracking, setMatrixClientServiceRef } =
				await loadModules();
			initUtdTracking();

			const client = createFakeMatrixClient();
			setMatrixClientServiceRef({ getClient: () => client } as any);
			flushClientPoll();

			const event = createFakeEncryptedEvent('$lost-key');
			client.emit('Room.timeline', event);
			event.simulateFailure(
				DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID
			);
			vi.advanceTimersByTime(GRACE_PERIOD_MS);

			expect(mockAdd).toHaveBeenCalledWith(1, {
				outcome: 'permanent',
				cause: DecryptionFailureCode.MEGOLM_UNKNOWN_INBOUND_SESSION_ID,
				category: 'bug'
			});
		});
	});
});
