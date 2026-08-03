import { useEffect, useMemo } from 'react';
import { useMatrixActivityEvent } from '../../hooks/useMatrixActivityEvent';
import { buildMatrixActivityTextPreview } from '../../utils/matrixActivityPreview';

type MatrixActivityPreviewHydratorProps = {
	activityEventId: string;
	roomRef: string;
	matrixEventId: string;
	senderName?: string | null;
	fallbackText: string;
	onPreviewChange: (activityEventId: string, preview: string) => void;
};

/**
 * Headless bridge between one persisted activity event and its local Matrix
 * event. Keeping this outside NotificationsCenter prevents Matrix lifecycle
 * logic from leaking into the large timeline component.
 */
export const MatrixActivityPreviewHydrator = ({
	activityEventId,
	roomRef,
	matrixEventId,
	senderName,
	fallbackText,
	onPreviewChange
}: MatrixActivityPreviewHydratorProps) => {
	const resolution = useMatrixActivityEvent(roomRef, matrixEventId);
	const preview = useMemo(
		() =>
			buildMatrixActivityTextPreview(
				resolution,
				senderName,
				fallbackText
			),
		[resolution, senderName, fallbackText]
	);

	useEffect(() => {
		onPreviewChange(activityEventId, preview);
	}, [activityEventId, onPreviewChange, preview]);

	return null;
};
