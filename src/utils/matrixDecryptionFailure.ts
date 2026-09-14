/**
 * Matrix exposes failed decryption in several shapes depending on whether the
 * event has already passed through the SDK's clear-event normalization.
 * Treat all of them as unavailable encrypted content; their SDK bodies are
 * diagnostics and must never become user-visible chat text.
 */
export const isUndecryptedRoomEvent = (event: any): boolean => {
	const clearContent = event?.getClearContent?.();
	const sdkFailureBody = (clearContent || event?.getContent?.())?.body;

	/*
	 * The body sniff below is a last resort for SDK builds that report a
	 * failure only in the text. It must never run on a plain `m.room.message`:
	 * this is a counselling platform, and someone asking about an error they
	 * saw ("bei mir stand: Unable to decrypt: DecryptionError") would have
	 * their own sentence replaced by the encrypted-content placeholder — their
	 * words silently swallowed by a diagnostic filter. An encrypted event, on
	 * the other hand, has no user-authored body to lose.
	 */
	const isEncryptedEvent =
		event?.getType?.() === 'm.room.encrypted' ||
		event?.getWireType?.() === 'm.room.encrypted' ||
		event?.isEncrypted?.() === true;

	return (
		event?.isDecryptionFailure?.() === true ||
		event?.getContent?.()?.msgtype === 'm.bad.encrypted' ||
		(event?.getType?.() === 'm.room.encrypted' && !clearContent?.msgtype) ||
		(isEncryptedEvent &&
			typeof sdkFailureBody === 'string' &&
			sdkFailureBody.includes('Unable to decrypt: DecryptionError'))
	);
};
