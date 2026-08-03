type MatrixPreviewEvent = {
	getType?: () => string;
	getContent?: () => Record<string, unknown>;
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
		const event = events[index];
		if (event?.getType?.() !== 'm.room.message') {
			continue;
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
		if (typeof body === 'string' && body.trim()) {
			return body;
		}
	}

	return null;
};
