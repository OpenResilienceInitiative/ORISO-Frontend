const decodeNumericEntity = (
	match: string,
	codePoint: string,
	radix: number
): string => {
	const parsed = Number.parseInt(codePoint, radix);
	return Number.isFinite(parsed) &&
		parsed >= 0 &&
		parsed <= 0x10ffff &&
		!(parsed >= 0xd800 && parsed <= 0xdfff)
		? String.fromCodePoint(parsed)
		: match;
};

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&#(\d+);/g, (match, codePoint: string) =>
			decodeNumericEntity(match, codePoint, 10)
		)
		.replace(/&#x([\da-f]+);/gi, (match, codePoint: string) =>
			decodeNumericEntity(match, codePoint, 16)
		);

const stripComposerMarkup = (value?: string | null): string => {
	const normalizedValue = (value || '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&#160;/gi, ' ')
		.replace(/\u00a0/g, ' ')
		.replace(/\u200b/g, '');

	if (!normalizedValue.trim()) {
		return '';
	}

	let plainText: string;
	if (typeof document !== 'undefined' && document.createElement) {
		const container = document.createElement('div');
		container.innerHTML = normalizedValue;
		plainText = container.textContent || '';
	} else {
		plainText = decodeHtmlEntities(
			normalizedValue.replace(/<[^>]+>/g, ' ')
		);
	}

	return plainText.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
};

const hasComposerTextContent = (value?: string | null): boolean =>
	stripComposerMarkup(value).trim().length > 0;

export const resolveComposerMessageSnapshot = (
	liveEditorHtml?: string | null,
	composerText?: string | null
): string => {
	const liveSnapshot = (liveEditorHtml ?? '').trim();
	const stateSnapshot = (composerText ?? '').trim();

	if (hasComposerTextContent(liveSnapshot)) {
		return liveSnapshot;
	}

	if (hasComposerTextContent(stateSnapshot)) {
		return stateSnapshot;
	}

	return liveSnapshot || stateSnapshot;
};

export const shouldPreserveComposerAfterRetry = (
	composerDraft?: string | null,
	retriedMessage?: string | null
): boolean =>
	stripComposerMarkup(composerDraft).trim() !==
	stripComposerMarkup(retriedMessage).trim();
