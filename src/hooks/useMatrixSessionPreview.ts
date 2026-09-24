import { useEffect, useMemo, useState } from 'react';
import { chatTransportService } from '../services/chatTransportService';
import { getLatestDecryptedMatrixMessage } from '../utils/matrixSessionPreview';

type MatrixPreviewSelector<T> = (events: any[]) => T | null;

type MatrixSessionEventsState = {
	roomId: string;
	events: any[];
};

const EMPTY_EVENTS: any[] = [];

/**
 * Load and subscribe to one Matrix timeline snapshot. Callers that need more
 * than one preview must derive them from this shared array instead of mounting
 * a second fetch/listener pair for the same room.
 */
export const useMatrixSessionEvents = (
	roomId: string | null | undefined,
	enabled: boolean
): any[] => {
	const [state, setState] = useState<MatrixSessionEventsState | null>(null);

	useEffect(() => {
		if (!enabled || !roomId) {
			setState(null);
			return;
		}

		const update = () => {
			setState({
				roomId,
				events:
					chatTransportService.getMatrixRoomMessages(roomId, 50) || []
			});
		};

		update();
		const detach = chatTransportService.onMatrixTimeline(roomId, update);
		return () => detach?.();
	}, [enabled, roomId]);

	return enabled && roomId && state?.roomId === roomId
		? state.events
		: EMPTY_EVENTS;
};

/**
 * Keep a session-card preview in sync with the local decrypted Matrix
 * timeline. The subscription depends only on the room identity and whether
 * preview access is allowed, so unrelated legacy E2EE state cannot reattach it.
 *
 * By default the newest decrypted text body is returned. Callers can pass a
 * stable `select` function (e.g. `getLatestMatrixRoomPreview`) to derive a
 * richer preview shape from the same timeline events.
 */
export const useMatrixSessionPreview = <T = string>(
	roomId: string | null | undefined,
	enabled: boolean,
	select?: MatrixPreviewSelector<T>
): T | null => {
	const selectPreview =
		select ??
		(getLatestDecryptedMatrixMessage as unknown as MatrixPreviewSelector<T>);
	const events = useMatrixSessionEvents(roomId, enabled);
	return useMemo(
		() => (enabled && roomId ? selectPreview(events) : null),
		[enabled, events, roomId, selectPreview]
	);
};
