import { useEffect, useState } from 'react';
import { MatrixEventEvent, type MatrixEvent } from 'matrix-js-sdk';
import { getMatrixClientService } from '../services/matrixClientRegistry';

/**
 * Per-message "encryption broke" detection for the delivery-status UI.
 *
 * Watches one Matrix room and returns the set of event ids that currently
 * fail to decrypt (`event.isEncrypted() && event.isDecryptionFailure()` on the
 * `MatrixEventEvent.Decrypted` event — the exact API the ops-only
 * `utdTracker.ts` already proves works). The consumer maps each rendered
 * message to `encryptionBroke={failures.has(message._id)}` — and `message._id`
 * is the Matrix event id (see `matrixTimelineEventFormatter`).
 *
 * A grace period mirrors `utdTracker`: a late Megolm key is normal and the SDK
 * self-heals, so a failure is only surfaced once it has persisted past the
 * grace window. A subsequent successful decrypt (the event type is promoted
 * away from `m.room.encrypted`) clears it again. This keeps the red cross off
 * every message during ordinary key sync.
 *
 * Unlike `utdTracker` (anonymous SigNoz telemetry, spans all rooms) this is a
 * per-room, per-event UI signal — so it lives as a hook scoped to the open
 * conversation, not a global counter. Best-effort: never throws into render.
 */

// Shorter than utdTracker's 5-min "permanent" classification: this is a live
// UI hint, not a telemetry verdict, so it should appear within seconds of a
// genuine failure while still riding out ordinary key-arrival latency.
const GRACE_PERIOD_MS = 12 * 1000;

export const useMatrixDecryptionFailures = (
	roomId: string | null | undefined
): ReadonlySet<string> => {
	const [failedEventIds, setFailedEventIds] = useState<ReadonlySet<string>>(
		() => new Set<string>()
	);

	useEffect(() => {
		if (!roomId) {
			setFailedEventIds((previous) =>
				previous.size ? new Set<string>() : previous
			);
			return;
		}

		const client = getMatrixClientService()?.getClient?.() ?? null;
		if (!client) {
			return;
		}

		let disposed = false;
		const failed = new Set<string>();
		// event id -> the listener + grace timer we attached, so we can detach.
		const tracked = new Map<
			string,
			{
				event: MatrixEvent;
				onDecrypted: () => void;
				timer: number | null;
			}
		>();

		const publish = (): void => {
			if (disposed) {
				return;
			}
			setFailedEventIds(new Set(failed));
		};

		const markFailed = (eventId: string): void => {
			if (!failed.has(eventId)) {
				failed.add(eventId);
				publish();
			}
		};

		const clearFailed = (eventId: string): void => {
			if (failed.delete(eventId)) {
				publish();
			}
		};

		const evaluate = (eventId: string, event: MatrixEvent): void => {
			const entry = tracked.get(eventId);
			// Decrypted successfully — the SDK promoted the type away from the
			// encrypted envelope. Cancel any pending grace timer and clear.
			if (event.getType() !== 'm.room.encrypted') {
				if (entry?.timer) {
					window.clearTimeout(entry.timer);
					entry.timer = null;
				}
				clearFailed(eventId);
				return;
			}
			if (event.isDecryptionFailure()) {
				if (!entry || entry.timer || failed.has(eventId)) {
					return; // already counting down or already surfaced
				}
				entry.timer = window.setTimeout(() => {
					entry.timer = null;
					if (
						event.getType() === 'm.room.encrypted' &&
						event.isDecryptionFailure()
					) {
						markFailed(eventId);
					}
				}, GRACE_PERIOD_MS);
			}
		};

		const attach = (event: MatrixEvent | undefined): void => {
			try {
				if (!event || event.getType() !== 'm.room.encrypted') {
					return;
				}
				const eventId = event.getId?.();
				if (!eventId || tracked.has(eventId)) {
					return;
				}
				const onDecrypted = () => evaluate(eventId, event);
				tracked.set(eventId, { event, onDecrypted, timer: null });
				(event as any).on(MatrixEventEvent.Decrypted, onDecrypted);
				// Cover the race where decryption already concluded before we
				// attached (e.g. events already in the timeline on mount).
				evaluate(eventId, event);
			} catch {
				// never throw into render
			}
		};

		const onTimeline = (
			event: MatrixEvent | undefined,
			room: { roomId?: string } | undefined
		): void => {
			if (room?.roomId === roomId) {
				attach(event);
			}
		};

		// Seed from events already loaded in the room's live timeline.
		try {
			const room = (client as any).getRoom?.(roomId);
			const events = room?.getLiveTimeline?.()?.getEvents?.() ?? [];
			events.forEach((event: MatrixEvent) => attach(event));
		} catch {
			// best-effort seeding
		}

		(client as any).on('Room.timeline', onTimeline);

		return () => {
			disposed = true;
			try {
				(client as any).off('Room.timeline', onTimeline);
			} catch {
				// ignore
			}
			tracked.forEach(({ event, onDecrypted, timer }) => {
				if (timer) {
					window.clearTimeout(timer);
				}
				try {
					(event as any).off(MatrixEventEvent.Decrypted, onDecrypted);
				} catch {
					// ignore
				}
			});
			tracked.clear();
		};
	}, [roomId]);

	return failedEventIds;
};
