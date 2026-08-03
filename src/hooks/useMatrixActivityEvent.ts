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
	const [resolution, setResolution] = useState<MatrixActivityEventResolution>(
		() => resolveLocalMatrixActivityEvent(roomRef, matrixEventId)
	);

	useEffect(() => {
		return subscribeToLocalMatrixActivityEvent(
			roomRef,
			matrixEventId,
			setResolution
		);
	}, [roomRef, matrixEventId]);

	return resolution;
};
