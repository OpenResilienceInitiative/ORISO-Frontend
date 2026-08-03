import { useEffect, useMemo } from 'react';
import { useMatrixActivityEvent } from '../../hooks/useMatrixActivityEvent';
import {
	buildMatrixActivityTextPreview,
	getMatrixActivityPreviewKind,
	type MatrixActivityPreviewKind,
	type MatrixActivityPreviewLabels
} from '../../utils/matrixActivityPreview';

type MatrixActivityPreviewHydratorProps = {
	activityEventId: string;
	roomRef: string;
	matrixEventId: string;
	senderName?: string | null;
	fallbackText: string;
	labels: MatrixActivityPreviewLabels;
	onPreviewChange: (
		activityEventId: string,
		preview: string,
		kind: MatrixActivityPreviewKind
	) => void;
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
	labels,
	onPreviewChange
}: MatrixActivityPreviewHydratorProps) => {
	const resolution = useMatrixActivityEvent(roomRef, matrixEventId);
	const preview = useMemo(
		() =>
			buildMatrixActivityTextPreview(
				resolution,
				senderName,
				fallbackText,
				labels
			),
		[resolution, senderName, fallbackText, labels]
	);
	const kind = useMemo(
		() => getMatrixActivityPreviewKind(resolution),
		[resolution]
	);

	useEffect(() => {
		onPreviewChange(activityEventId, preview, kind);
	}, [activityEventId, kind, onPreviewChange, preview]);

	return null;
};
