import { HighlightSnippetPayload } from './TipTapComposer';

export const HIGHLIGHT_SNIPPET_SELECTED_EVENT =
	'oriso:highlight-snippet-selected';

export const dispatchHighlightSnippetSelected = (
	payload: HighlightSnippetPayload
) => {
	window.dispatchEvent(
		new CustomEvent(HIGHLIGHT_SNIPPET_SELECTED_EVENT, { detail: payload })
	);
};


