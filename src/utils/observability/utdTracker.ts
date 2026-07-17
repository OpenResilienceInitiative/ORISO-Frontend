import { metrics, type Counter, type Attributes } from '@opentelemetry/api';
import {
	MatrixEventEvent,
	type MatrixClient,
	type MatrixEvent
} from 'matrix-js-sdk';
import { DecryptionFailureCode } from 'matrix-js-sdk/lib/crypto-api';
import { getMatrixClientService } from '../../services/matrixClientRegistry';

/**
 * "Unable To Decrypt" (UTD) failure tracking (OBS-P9, ORISO-Helm#62,
 * ORISO-Frontend#440). Exports one OpenTelemetry counter -- how often
 * encrypted counselling messages permanently fail to decrypt -- to our
 * self-hosted SigNoz collector via the MeterProvider set up in
 * `meterProvider.ts`.
 *
 * The meter name ('utd-tracker') and the counter name ('decryption_failure')
 * are a dashboard contract: a follow-up SigNoz dashboard queries these names
 * by string, so a typo here breaks that silently.
 *
 * Deliberately NOT included, ever: room id, event id, sender, user id, or
 * anything else that could identify a specific conversation or person. This
 * is dev/ops tooling only, never per-user/per-conversation tracking
 * (ADR-011) -- doubly so here since this observes encrypted counselling
 * conversations specifically. `cause`/`outcome`/`category` describe the
 * health of the crypto pipeline without revealing who talked to whom.
 *
 * Grace period: matrix-js-sdk does not distinguish a transient failure (the
 * decryption key arrives a little late and the SDK self-heals) from a
 * permanent one -- that's left to the consumer. This mirrors the 5-minute
 * grace-period pattern `chatTransportService.onMatrixTimeline` already uses
 * for its own (unrelated) UI-refresh purpose, so both classify "how long is
 * too long" the same way. That existing mechanism is scoped to whichever
 * single room a component currently has open, though, so it can't be reused
 * as-is for telemetry that must span every room -- this module runs its own,
 * separate grace-period tracker, keyed by event id, wired directly onto the
 * Matrix client's `Room.timeline` event (which already fires for all rooms).
 *
 * Best-effort, must never throw -- same try/catch discipline as the rest of
 * this observability code.
 */

const METER_NAME = 'utd-tracker';
const COUNTER_NAME = 'decryption_failure';
const GRACE_PERIOD_MS = 5 * 60 * 1000;

// How often to check whether a Matrix client has become available (login)
// or been swapped out (token refresh creates a new client instance, logout
// clears it). initUtdTracking() runs once, very early at app startup --
// long before login -- so there is no login/logout/refresh hook to attach
// to directly without reaching into matrixClientService.ts; polling is the
// simplest way to stay a self-contained, additive module.
const CLIENT_POLL_INTERVAL_MS = 2000;

const WITHHELD_CODES: ReadonlySet<DecryptionFailureCode> = new Set([
	DecryptionFailureCode.MEGOLM_KEY_WITHHELD,
	DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE
]);

// MSC4153-adjacent: a withheld key is an intentional, expected outcome (the
// sender chose not to share it, e.g. to an unverified device), not a bug.
// Every other code indicates the crypto pipeline itself misbehaved.
const categoryFor = (cause: DecryptionFailureCode): 'withheld' | 'bug' =>
	WITHHELD_CODES.has(cause) ? 'withheld' : 'bug';

type PendingFailure = {
	cause: DecryptionFailureCode;
	timeout: ReturnType<typeof setTimeout>;
};

type TrackedListener = {
	event: MatrixEvent;
	onDecrypted: () => void;
};

/**
 * Attaches the per-client 'Room.timeline' + per-event 'Event.decrypted'
 * tracking. Returns a detach function that undoes everything (listeners and
 * in-flight timers) so it can be safely re-run against a new client
 * instance (e.g. after a token refresh recreates the underlying
 * MatrixClient).
 */
const attachToClient = (
	client: MatrixClient,
	counter: Counter
): (() => void) => {
	const pendingFailures = new Map<string, PendingFailure>();
	const trackedListeners = new Map<string, TrackedListener>();

	const safeAdd = (attributes: Attributes): void => {
		try {
			counter.add(1, attributes);
		} catch {
			// telemetry must never throw
		}
	};

	const detach = (eventId: string): void => {
		const tracked = trackedListeners.get(eventId);
		if (!tracked) {
			return;
		}
		try {
			(tracked.event as any).off(
				MatrixEventEvent.Decrypted,
				tracked.onDecrypted
			);
		} catch {
			// telemetry must never throw
		}
		trackedListeners.delete(eventId);
	};

	const clearPending = (eventId: string): void => {
		const pending = pendingFailures.get(eventId);
		if (!pending) {
			return;
		}
		clearTimeout(pending.timeout);
		pendingFailures.delete(eventId);
	};

	// Re-evaluates one event's current decryption state, either right after
	// attaching (covers the race where decryption already concluded before
	// we got a listener on) or from the 'Event.decrypted' callback (the
	// normal path).
	const evaluate = (eventId: string, event: MatrixEvent): void => {
		if (event.getType() !== 'm.room.encrypted') {
			// Decrypted successfully (the event's type was promoted away
			// from the encrypted envelope type).
			const pending = pendingFailures.get(eventId);
			if (pending) {
				clearPending(eventId);
				safeAdd({
					outcome: 'transient_resolved',
					cause: pending.cause
				});
			}
			detach(eventId);
			return;
		}

		if (event.isDecryptionFailure()) {
			if (pendingFailures.has(eventId)) {
				// Already tracking this failure; a repeat 'Event.decrypted'
				// fire with another failure doesn't restart the clock.
				return;
			}
			const cause =
				event.decryptionFailureReason ??
				DecryptionFailureCode.UNKNOWN_ERROR;
			const timeout = setTimeout(() => {
				pendingFailures.delete(eventId);
				detach(eventId);
				safeAdd({
					outcome: 'permanent',
					cause,
					category: categoryFor(cause)
				});
			}, GRACE_PERIOD_MS);
			pendingFailures.set(eventId, { cause, timeout });
			return;
		}

		// Still the encrypted envelope type but not (yet) a failure: no
		// decryption attempt has concluded yet. Keep waiting.
	};

	const handleTimeline = (event: MatrixEvent | undefined): void => {
		try {
			if (!event || event.getType() !== 'm.room.encrypted') {
				return;
			}
			const eventId = event.getId?.();
			if (!eventId || trackedListeners.has(eventId)) {
				return;
			}

			const onDecrypted = (): void => evaluate(eventId, event);
			trackedListeners.set(eventId, { event, onDecrypted });
			(event as any).on(MatrixEventEvent.Decrypted, onDecrypted);

			// Cover the race where the event already finished decrypting
			// (success or failure) before this listener was attached.
			evaluate(eventId, event);
		} catch {
			// telemetry must never throw
		}
	};

	(client as any).on('Room.timeline', handleTimeline);

	return () => {
		try {
			(client as any).off('Room.timeline', handleTimeline);
		} catch {
			// telemetry must never throw
		}
		Array.from(trackedListeners.keys()).forEach(detach);
		Array.from(pendingFailures.keys()).forEach(clearPending);
	};
};

let initialized = false;

/**
 * Wires the UTD (Unable To Decrypt) tracker to an OpenTelemetry counter.
 * Only needs to run once per page load -- call this once at app startup,
 * alongside `initMeterProvider`/`initWebVitals`, not per component.
 *
 * The Matrix client doesn't exist yet at app startup (it's created on
 * login, and re-created on token refresh), so this polls for it becoming
 * available/changing rather than requiring a direct hook into
 * matrixClientService.ts.
 */
export const initUtdTracking = (): void => {
	if (initialized) {
		return;
	}
	initialized = true;

	try {
		const meter = metrics.getMeter(METER_NAME);
		const counter = meter.createCounter(COUNTER_NAME);

		let attachedClient: MatrixClient | null = null;
		let detachFromClient: (() => void) | null = null;

		const checkForClient = (): void => {
			try {
				const client = getMatrixClientService()?.getClient?.() ?? null;

				if (client === attachedClient) {
					return;
				}

				detachFromClient?.();
				attachedClient = client;
				detachFromClient = client
					? attachToClient(client, counter)
					: null;
			} catch {
				// telemetry must never throw
			}
		};

		checkForClient();
		setInterval(checkForClient, CLIENT_POLL_INTERVAL_MS);
	} catch (e) {
		// Swallow wiring failures -- this is telemetry, not a critical
		// path, and must never surface as a new error or block app startup.
	}
};
