import { MatrixEventEvent, type MatrixEvent } from 'matrix-js-sdk';
import { chatTransportService } from '../services/chatTransportService';

export type MatrixActivityEventResolution =
	| { status: 'resolved'; event: MatrixEvent }
	| { status: 'pending-decryption'; event: MatrixEvent }
	| { status: 'room-unavailable' }
	| { status: 'event-unavailable' };

type ResolutionListener = (resolution: MatrixActivityEventResolution) => void;
type WatchedEvent = {
	listeners: Set<ResolutionListener>;
	pendingEvent?: MatrixEvent;
	pendingListener?: (event: MatrixEvent, error?: Error) => void;
};
type WatchedRoom = {
	events: Map<string, WatchedEvent>;
	detachTimeline: (() => void) | null;
};

const watchedRooms = new Map<string, WatchedRoom>();

/**
 * Resolve one activity event to the exact Matrix event already held by the
 * local SDK. This is deliberately cache-only: it does not paginate, send a
 * read receipt or register the conversation as actively viewed.
 */
export const resolveLocalMatrixActivityEvent = (
	roomRef: string,
	matrixEventId: string
): MatrixActivityEventResolution => {
	const room = chatTransportService.getMatrixRoom(roomRef);
	if (!room) {
		return { status: 'room-unavailable' };
	}

	const event = room.findEventById(matrixEventId);
	if (!event) {
		return { status: 'event-unavailable' };
	}

	return event.getType() === 'm.room.encrypted'
		? { status: 'pending-decryption', event }
		: { status: 'resolved', event };
};

const clearPendingDecryption = (watchedEvent: WatchedEvent) => {
	if (watchedEvent.pendingEvent && watchedEvent.pendingListener) {
		watchedEvent.pendingEvent.off(
			MatrixEventEvent.Decrypted,
			watchedEvent.pendingListener as any
		);
	}
	delete watchedEvent.pendingEvent;
	delete watchedEvent.pendingListener;
};

const refreshWatchedEvent = (roomRef: string, matrixEventId: string) => {
	const watchedEvent = watchedRooms.get(roomRef)?.events.get(matrixEventId);
	if (!watchedEvent) return;

	const resolution = resolveLocalMatrixActivityEvent(roomRef, matrixEventId);
	if (resolution.status !== 'pending-decryption') {
		clearPendingDecryption(watchedEvent);
	} else if (watchedEvent.pendingEvent !== resolution.event) {
		clearPendingDecryption(watchedEvent);
		const pendingListener = (event: MatrixEvent, error?: Error) => {
			if (!error && event.getId() === matrixEventId) {
				refreshWatchedEvent(roomRef, matrixEventId);
			}
		};
		watchedEvent.pendingEvent = resolution.event;
		watchedEvent.pendingListener = pendingListener;
		resolution.event.on(MatrixEventEvent.Decrypted, pendingListener as any);
		// Close the race where decryption completed while the listener attached.
		if (resolution.event.getType() !== 'm.room.encrypted') {
			refreshWatchedEvent(roomRef, matrixEventId);
			return;
		}
	}

	Array.from(watchedEvent.listeners).forEach((listener) =>
		listener(resolution)
	);
};

/**
 * Watch one exact local Matrix event. Subscribers for the same room share one
 * raw SDK timeline listener; only pending events that are actually referenced
 * by an activity card receive a decryption listener.
 */
export const subscribeToLocalMatrixActivityEvent = (
	roomRef: string,
	matrixEventId: string,
	listener: ResolutionListener
): (() => void) => {
	let watchedRoom = watchedRooms.get(roomRef);
	if (!watchedRoom) {
		watchedRoom = { events: new Map(), detachTimeline: null };
		watchedRooms.set(roomRef, watchedRoom);
		watchedRoom.detachTimeline = chatTransportService.onMatrixTimelineRaw(
			roomRef,
			(event) => {
				const eventId = event.getId();
				if (eventId && watchedRooms.get(roomRef)?.events.has(eventId)) {
					refreshWatchedEvent(roomRef, eventId);
				}
			}
		);
	}

	let watchedEvent = watchedRoom.events.get(matrixEventId);
	if (!watchedEvent) {
		watchedEvent = { listeners: new Set() };
		watchedRoom.events.set(matrixEventId, watchedEvent);
	}
	watchedEvent.listeners.add(listener);
	refreshWatchedEvent(roomRef, matrixEventId);

	return () => {
		const currentRoom = watchedRooms.get(roomRef);
		const currentEvent = currentRoom?.events.get(matrixEventId);
		if (!currentRoom || !currentEvent) return;
		currentEvent.listeners.delete(listener);
		if (currentEvent.listeners.size === 0) {
			clearPendingDecryption(currentEvent);
			currentRoom.events.delete(matrixEventId);
		}
		if (currentRoom.events.size === 0) {
			currentRoom.detachTimeline?.();
			watchedRooms.delete(roomRef);
		}
	};
};
