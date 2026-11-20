/**
 * Matrix exposes failed decryption in several shapes depending on whether the
 * event has already passed through the SDK's clear-event normalization.
 * Treat all of them as unavailable encrypted content; their SDK bodies are
 * diagnostics and must never become user-visible chat text.
 */
export const isUndecryptedRoomEvent = (event: any): boolean => {
	const clearContent = event?.getClearContent?.();

	// Encrypted transport metadata survives successful decryption. Only the
	// SDK failure state or an event that still lacks clear content is evidence
	// of unavailable plaintext; diagnostic quotations can be user-authored.
	return (
		event?.isDecryptionFailure?.() === true ||
		clearContent?.msgtype === 'm.bad.encrypted' ||
		event?.getContent?.()?.msgtype === 'm.bad.encrypted' ||
		(event?.getType?.() === 'm.room.encrypted' && !clearContent?.msgtype)
	);
};

/**
 * SDK failure codes (`DecryptionFailureCode`, matrix-js-sdk) that mean one
 * thing for the person reading: this device never received the room key for
 * that message. Megolm keys only reach devices that existed when the message
 * was sent (ADR-002 rejected key escrow), so this is the expected state of
 * history from before a device joined, e.g. after a case handover. The text
 * is neutral on purpose: nothing is broken, the message is just not here yet.
 *
 * Compared as plain strings so this module stays free of SDK imports.
 */
const MISSING_KEY_FAILURE_CODES: ReadonlySet<string> = new Set([
	'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
	'MEGOLM_KEY_WITHHELD',
	'MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE',
	'HISTORICAL_MESSAGE_NO_KEY_BACKUP',
	'HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED',
	'HISTORICAL_MESSAGE_WORKING_BACKUP',
	'HISTORICAL_MESSAGE_USER_NOT_JOINED'
]);

export type UndecryptedReason = 'missing-key' | 'other';

/** `null` for a readable event; otherwise why its plaintext is unavailable. */
export const getUndecryptedReason = (event: any): UndecryptedReason | null => {
	if (!isUndecryptedRoomEvent(event)) {
		return null;
	}
	const code = event?.decryptionFailureReason;
	return typeof code === 'string' && MISSING_KEY_FAILURE_CODES.has(code)
		? 'missing-key'
		: 'other';
};

export const isMissingKeyDecryptionFailure = (event: any): boolean =>
	getUndecryptedReason(event) === 'missing-key';

/** i18n node of the missing-key wording; plural keys `title_*`/`hint_*` via `count`. */
export const MISSING_KEY_COPY_KEY = 'e2ee.message.encryption.missingKey';
