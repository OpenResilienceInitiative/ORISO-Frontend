import { useEffect, useState } from 'react';
import { MatrixEventEvent, type MatrixEvent } from 'matrix-js-sdk';
import { chatTransportService } from '../services/chatTransportService';
import {
	MatrixActivityEventResolution,
	resolveLocalMatrixActivityEvent
} from '../utils/matrixActivityEventResolver';

/**
 * Keep one Activity Timeline reference synchronized with its exact local
 * Matrix event. Reading and subscribing here is intentionally side-effect
 * free with respect to conversation state: no active-view registration and
 * no read receipt are performed.
 */
export const useMatrixActivityEvent = (
	roomRef: string,
	matrixEventId: string
): MatrixActivityEventResolution => {
	const [resolution, setResolution] = useState<MatrixActivityEventResolution>(
		() => resolveLocalMatrixActivityEvent(roomRef, matrixEventId)
	);

	useEffect(() => {
		let pendingEvent: MatrixEvent | null = null;
		let detached = false;

		const clearPendingEvent = () => {
			pendingEvent?.off(
				MatrixEventEvent.Decrypted,
				handleDecrypted as any
			);
			pendingEvent = null;
		};

		const applyResolution = (next: MatrixActivityEventResolution) => {
			if (detached) return;
			setResolution(next);
			if (next.status !== 'pending-decryption') {
				clearPendingEvent();
				return;
			}
			if (pendingEvent === next.event) return;
			clearPendingEvent();
			pendingEvent = next.event;
			pendingEvent.on(MatrixEventEvent.Decrypted, handleDecrypted as any);
		};

		const refresh = () =>
			applyResolution(
				resolveLocalMatrixActivityEvent(roomRef, matrixEventId)
			);

		function handleDecrypted(event: MatrixEvent, error?: Error) {
			if (error || event.getId() !== matrixEventId) return;
			refresh();
		}

		refresh();
		const detachTimeline = chatTransportService.onMatrixTimeline(
			roomRef,
			(event) => {
				if (event.getId() === matrixEventId) {
					refresh();
				}
			}
		);

		return () => {
			detached = true;
			detachTimeline?.();
			clearPendingEvent();
		};
	}, [roomRef, matrixEventId]);

	return resolution;
};
