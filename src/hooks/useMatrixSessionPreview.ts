import { useEffect, useState } from 'react';
import { chatTransportService } from '../services/chatTransportService';
import { getLatestDecryptedMatrixMessage } from '../utils/matrixSessionPreview';

type MatrixSessionPreviewState<T> = {
	roomId: string;
	message: T | null;
};

type MatrixPreviewSelector<T> = (events: any[]) => T | null;

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
	const [preview, setPreview] = useState<MatrixSessionPreviewState<T> | null>(
		null
	);

	useEffect(() => {
		if (!enabled || !roomId) {
			setPreview(null);
			return;
		}

		const updatePreview = () => {
			const events =
				chatTransportService.getMatrixRoomMessages(roomId, 50) || [];
			setPreview({
				roomId,
				message: selectPreview(events)
			});
		};

		updatePreview();
		const detach = chatTransportService.onMatrixTimeline(
			roomId,
			updatePreview
		);

		return () => detach?.();
	}, [enabled, roomId, selectPreview]);

	return enabled && roomId && preview?.roomId === roomId
		? preview.message
		: null;
};
