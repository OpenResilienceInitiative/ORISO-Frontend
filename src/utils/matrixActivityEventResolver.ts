import type { MatrixEvent } from 'matrix-js-sdk';
import { chatTransportService } from '../services/chatTransportService';

export type MatrixActivityEventResolution =
	| { status: 'resolved'; event: MatrixEvent }
	| { status: 'pending-decryption'; event: MatrixEvent }
	| { status: 'room-unavailable' }
	| { status: 'event-unavailable' };

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
