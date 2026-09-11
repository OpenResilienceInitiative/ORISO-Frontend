export type MatrixPreviewEvent = {
	getType?: () => string;
	getContent?: () => Record<string, unknown>;
};

/** Return the displayable plain-text body of one already decrypted event. */
export const getDecryptedMatrixMessageText = (
	event: MatrixPreviewEvent
): string | null => {
	if (event?.getType?.() !== 'm.room.message') {
		return null;
	}

	const content = event.getContent?.() ?? {};
	const replacement = content['m.new_content'];
	const replacementBody =
		typeof replacement === 'object' && replacement !== null
			? (replacement as Record<string, unknown>).body
			: undefined;
	const body =
		typeof replacementBody === 'string' && replacementBody.trim()
			? replacementBody
			: content.body;
	return typeof body === 'string' && body.trim() ? body : null;
};

/**
 * Return the newest text that the local Matrix SDK has already decrypted.
 * Encrypted events deliberately have no preview until their clear event is
 * available on this device.
 */
export const getLatestDecryptedMatrixMessage = (
	events: MatrixPreviewEvent[] = []
): string | null => {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const body = getDecryptedMatrixMessageText(events[index]);
		if (body) return body;
	}

	return null;
};
