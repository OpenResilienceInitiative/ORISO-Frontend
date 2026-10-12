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
