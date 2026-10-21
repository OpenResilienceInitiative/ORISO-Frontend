import type { MatrixEvent } from 'matrix-js-sdk';
import type { MatrixActivityEventResolution } from './matrixActivityEventResolver';
import { getDecryptedMatrixMessageText } from './matrixSessionPreview';
import {
	getSystemNotificationPreview,
	toMessagePreviewText
} from './messagePreviewText';
import { parseErstantwortPayload } from '../components/erstantwort/erstantwortPayload';
import { parseMessagePrefixes } from '../components/message/messageConstants';

const normalizePreviewText = (value: string): string =>
	value.replace(/\s+/g, ' ').trim();

export type MatrixActivityPreviewLabels = {
	image: string;
	file: string;
	audio: string;
	video: string;
	notice: string;
	userLeftChat: string;
	systemNotification: string;
	unsupported: string;
	undecryptable: string;
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
	| 'undecryptable'
	| 'unknown';

/** The SDK swaps an event it cannot decrypt for `m.bad.encrypted` content. */
const isUndecryptable = (event: MatrixEvent): boolean =>
	event.isDecryptionFailure?.() === true ||
	event.getContent?.()?.msgtype === 'm.bad.encrypted';

export const getMatrixActivityPreviewKind = (
	resolution: MatrixActivityEventResolution
): MatrixActivityPreviewKind => {
	if (resolution.status !== 'resolved') return 'unknown';
	if (isUndecryptable(resolution.event)) return 'undecryptable';
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

	if (isUndecryptable(resolution.event)) {
		return withSender(senderName, labels?.undecryptable || fallbackText);
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

	const rawBody = getDecryptedMatrixMessageText(resolution.event);
	const firstResponse = parseErstantwortPayload(rawBody);
	if (firstResponse.status !== 'none') {
		const preview =
			firstResponse.status === 'ok'
				? toMessagePreviewText(firstResponse.bausteine[0]?.body) ||
					labels?.notice ||
					fallbackText
				: labels?.unsupported || fallbackText;
		return withSender(senderName, preview);
	}
	const systemNotice = getSystemNotificationPreview(rawBody);
	if (systemNotice) {
		return (
			(systemNotice === 'user_left_chat'
				? labels?.userLeftChat
				: labels?.systemNotification) || fallbackText
		);
	}
	const body = toMessagePreviewText(rawBody);
	if (!body) {
		return fallbackText;
	}

	// The chat draws a system notice without its sender, so the preview does too.
	return parseMessagePrefixes(rawBody).isSystemNotification
		? body
		: withSender(senderName, body);
};
