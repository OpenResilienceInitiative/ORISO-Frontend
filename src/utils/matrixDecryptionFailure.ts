/**
 * Matrix exposes failed decryption in several shapes depending on whether the
 * event has already passed through the SDK's clear-event normalization.
 * Treat all of them as unavailable encrypted content; their SDK bodies are
 * diagnostics and must never become user-visible chat text.
 */
export const isUndecryptedRoomEvent = (event: any): boolean => {
	const clearContent = event?.getClearContent?.();
	const sdkFailureBody = (clearContent || event?.getContent?.())?.body;

	return (
		event?.isDecryptionFailure?.() === true ||
		event?.getContent?.()?.msgtype === 'm.bad.encrypted' ||
		(event?.getType?.() === 'm.room.encrypted' && !clearContent?.msgtype) ||
		(typeof sdkFailureBody === 'string' &&
			sdkFailureBody.includes('Unable to decrypt: DecryptionError'))
	);
};
