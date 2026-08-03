import { useEffect, useState } from 'react';
import {
	MatrixActivityEventResolution,
	resolveLocalMatrixActivityEvent,
	subscribeToLocalMatrixActivityEvent
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
	const [state, setState] = useState(() => ({
		roomRef,
		matrixEventId,
		resolution: resolveLocalMatrixActivityEvent(roomRef, matrixEventId)
	}));
	const resolution =
		state.roomRef === roomRef && state.matrixEventId === matrixEventId
			? state.resolution
			: resolveLocalMatrixActivityEvent(roomRef, matrixEventId);

	useEffect(() => {
		return subscribeToLocalMatrixActivityEvent(
			roomRef,
			matrixEventId,
			(nextResolution) =>
				setState({ roomRef, matrixEventId, resolution: nextResolution })
		);
	}, [roomRef, matrixEventId]);

	return resolution;
};
