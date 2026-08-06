import { useEffect, useState } from 'react';
import { chatTransportService } from '../services/chatTransportService';
import { getLatestDecryptedMatrixMessage } from '../utils/matrixSessionPreview';

type MatrixSessionPreviewState = {
	roomId: string;
	message: string | null;
};

/**
 * Keep a session-card preview in sync with the local decrypted Matrix
 * timeline. The subscription depends only on the room identity and whether
 * preview access is allowed, so unrelated legacy E2EE state cannot reattach it.
 */
export const useMatrixSessionPreview = (
	roomId: string | null | undefined,
	enabled: boolean
): string | null => {
	const [preview, setPreview] = useState<MatrixSessionPreviewState | null>(
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
				message: getLatestDecryptedMatrixMessage(events)
			});
		};

		updatePreview();
		const detach = chatTransportService.onMatrixTimeline(
			roomId,
			updatePreview
		);

		return () => detach?.();
	}, [enabled, roomId]);

	return enabled && roomId && preview?.roomId === roomId
		? preview.message
		: null;
};
