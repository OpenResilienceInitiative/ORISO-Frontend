import type { MatrixActivityEventResolution } from './matrixActivityEventResolver';
import { getDecryptedMatrixMessageText } from './matrixSessionPreview';

const normalizePreviewText = (value: string): string =>
	value.replace(/\s+/g, ' ').trim();

export type MatrixActivityPreviewLabels = {
	image: string;
	file: string;
	audio: string;
	video: string;
	notice: string;
	unsupported: string;
	pending: string;
	roomUnavailable: string;
	eventUnavailable: string;
};

export type MatrixActivityPreviewKind =
	| 'text'
	| 'image'
	| 'file'
	| 'audio'
	| 'video'
	| 'notice'
	| 'unsupported'
	| 'unknown';

export const getMatrixActivityPreviewKind = (
	resolution: MatrixActivityEventResolution
): MatrixActivityPreviewKind => {
	if (resolution.status !== 'resolved') return 'unknown';
	const content = resolution.event.getContent?.() ?? {};
	const msgtype =
		typeof content.msgtype === 'string' ? content.msgtype : null;
	const kindByType: Record<string, MatrixActivityPreviewKind> = {
		'm.text': 'text',
		'm.image': 'image',
		'm.file': 'file',
		'm.audio': 'audio',
		'm.video': 'video',
		'm.notice': 'notice'
	};
	return msgtype ? kindByType[msgtype] || 'unsupported' : 'text';
};

const withSender = (
	senderName: string | null | undefined,
	preview: string
): string => {
	const normalizedSender = senderName ? normalizePreviewText(senderName) : '';
	return normalizedSender ? `${normalizedSender}: ${preview}` : preview;
};

/**
 * Format a locally decrypted text event for an Activity Timeline card.
 * Matrix's plain `body` is used; formatted HTML is deliberately ignored and
 * the returned value is rendered by React as text, never injected as markup.
 */
export const buildMatrixActivityTextPreview = (
	resolution: MatrixActivityEventResolution,
	senderName: string | null | undefined,
	fallbackText: string,
	labels?: MatrixActivityPreviewLabels
): string => {
	if (resolution.status !== 'resolved') {
		const fallbackByStatus = {
			'pending-decryption': labels?.pending,
			'room-unavailable': labels?.roomUnavailable,
			'event-unavailable': labels?.eventUnavailable
		};
		return fallbackByStatus[resolution.status] || fallbackText;
	}

	const content = resolution.event.getContent?.() ?? {};
	const msgtype =
		typeof content.msgtype === 'string' ? content.msgtype : null;
	if (msgtype && msgtype !== 'm.text') {
		const labelByType: Record<string, string | undefined> = {
			'm.image': labels?.image,
			'm.file': labels?.file,
			'm.audio': labels?.audio,
			'm.video': labels?.video,
			'm.notice': labels?.notice
		};
		return withSender(
			senderName,
			labelByType[msgtype] || labels?.unsupported || fallbackText
		);
	}

	const body = getDecryptedMatrixMessageText(resolution.event);
	if (!body) {
		return fallbackText;
	}

	return withSender(senderName, normalizePreviewText(body));
};
