import { useCallback, useEffect, useState, type RefObject } from 'react';

import { normalizePassage } from './passageRange';

/** A passage someone marked in one message of the timeline. */
export interface MarkedPassage {
	eventId: string;
	/** Display name of the message's author. */
	author: string;
	/** The marked text, whitespace collapsed. */
	text: string;
}

/** Where the passage sits, in px relative to the selection layer. */
export interface PassageAnchor {
	top: number;
	bottom: number;
	centerX: number;
	layerWidth: number;
	/**
	 * The band of the layer the reader actually sees, in layer coordinates:
	 * the scroll area minus what the docked composer covers (its reserve is
	 * the scroll area's bottom padding).
	 */
	visibleTop: number;
	visibleBottom: number;
}

const scrollParentOf = (element: HTMLElement): HTMLElement | null => {
	let current = element.parentElement;
	while (current) {
		const { overflowY } = getComputedStyle(current);
		if (overflowY === 'auto' || overflowY === 'scroll') {
			return current;
		}
		current = current.parentElement;
	}
	return null;
};

export interface MessageSelection {
	passage: MarkedPassage;
	anchor: PassageAnchor;
	/** A copy of the selected range, kept after the native selection goes. */
	range: Range;
}

const MIN_PASSAGE_LENGTH = 2;
const QUOTE_OR_CONTROL =
	'.messageItem__replyQuote, button, input, textarea, [contenteditable="true"]';

export const anchorFor = (rect: DOMRect, layer: HTMLElement): PassageAnchor => {
	const box = layer.getBoundingClientRect();
	const scroller = scrollParentOf(layer);
	const view = scroller
		? scroller.getBoundingClientRect()
		: { top: 0, bottom: window.innerHeight };
	const reserve = scroller
		? parseFloat(getComputedStyle(scroller).paddingBottom) || 0
		: 0;
	return {
		top: rect.top - box.top,
		bottom: rect.bottom - box.top,
		centerX: rect.left - box.left + rect.width / 2,
		layerWidth: box.width,
		visibleTop: Math.max(view.top, 0) - box.top,
		visibleBottom: view.bottom - reserve - box.top
	};
};

/**
 * Reads what the user marked inside a message bubble of the timeline under
 * `layerRef`. Only a selection that starts and ends in the text of ONE
 * message counts; a selection across messages, in the composer, or in a
 * reply's own quote is ignored.
 */
export const useMessageSelection = (
	layerRef: RefObject<HTMLElement | null>,
	{
		enabled,
		authorFor
	}: {
		enabled: boolean;
		/** Display name of the author of message `eventId`. */
		authorFor: (eventId: string) => string;
	}
) => {
	const [selection, setSelection] = useState<MessageSelection | null>(null);

	const read = useCallback(() => {
		const layer = layerRef.current;
		const native = window.getSelection();
		if (
			!layer ||
			!native ||
			native.rangeCount === 0 ||
			native.isCollapsed
		) {
			return null;
		}
		const range = native.getRangeAt(0);
		const startEl =
			range.startContainer instanceof Element
				? range.startContainer
				: range.startContainer.parentElement;
		const endEl =
			range.endContainer instanceof Element
				? range.endContainer
				: range.endContainer.parentElement;
		const bubble = startEl?.closest<HTMLElement>('.messageItem__message');
		if (
			!bubble ||
			!layer.contains(bubble) ||
			bubble !== endEl?.closest('.messageItem__message') ||
			startEl?.closest(QUOTE_OR_CONTROL) ||
			endEl?.closest(QUOTE_OR_CONTROL)
		) {
			return null;
		}
		const eventId =
			bubble
				.closest<HTMLElement>('[data-message-id]')
				?.getAttribute('data-message-id') || '';
		const text = normalizePassage(native.toString());
		if (!eventId || text.length < MIN_PASSAGE_LENGTH) {
			return null;
		}
		return {
			passage: { eventId, author: authorFor(eventId), text },
			anchor: anchorFor(range.getBoundingClientRect(), layer),
			range: range.cloneRange()
		};
	}, [layerRef, authorFor]);

	useEffect(() => {
		const layer = layerRef.current;
		if (!enabled || !layer) {
			return undefined;
		}
		// Read after the browser has settled the selection for this event.
		const onRelease = () =>
			window.setTimeout(() => {
				const next = read();
				if (next) {
					setSelection(next);
				}
			}, 0);
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.shiftKey || event.key === 'Shift') {
				onRelease();
			}
		};
		layer.addEventListener('mouseup', onRelease);
		layer.addEventListener('touchend', onRelease);
		layer.addEventListener('keyup', onKeyUp);
		return () => {
			layer.removeEventListener('mouseup', onRelease);
			layer.removeEventListener('touchend', onRelease);
			layer.removeEventListener('keyup', onKeyUp);
		};
	}, [enabled, layerRef, read]);

	const clear = useCallback(() => setSelection(null), []);

	return { selection, setSelection, clear };
};
