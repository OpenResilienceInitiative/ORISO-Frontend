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

	if (typeof document !== 'undefined' && document.createElement) {
		const container = document.createElement('div');
		container.innerHTML = normalizedValue;
		return (container.textContent || '')
			.replace(/\u00a0/g, ' ')
			.replace(/\u200b/g, '');
	}

	return normalizedValue.replace(/<[^>]+>/g, ' ');
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
