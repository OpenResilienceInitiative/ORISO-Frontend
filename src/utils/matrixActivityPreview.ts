import type { MatrixActivityEventResolution } from './matrixActivityEventResolver';
import { getDecryptedMatrixMessageText } from './matrixSessionPreview';

const normalizePreviewText = (value: string): string =>
	value.replace(/\s+/g, ' ').trim();

/**
 * Format a locally decrypted text event for an Activity Timeline card.
 * Matrix's plain `body` is used; formatted HTML is deliberately ignored and
 * the returned value is rendered by React as text, never injected as markup.
 */
export const buildMatrixActivityTextPreview = (
	resolution: MatrixActivityEventResolution,
	senderName: string | null | undefined,
	fallbackText: string
): string => {
	if (resolution.status !== 'resolved') {
		return fallbackText;
	}

	const body = getDecryptedMatrixMessageText(resolution.event);
	if (!body) {
		return fallbackText;
	}

	const normalizedBody = normalizePreviewText(body);
	const normalizedSender = senderName ? normalizePreviewText(senderName) : '';
	return normalizedSender
		? `${normalizedSender}: ${normalizedBody}`
		: normalizedBody;
};
