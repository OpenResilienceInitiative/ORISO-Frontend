import { useRef, useSyncExternalStore } from 'react';

/**
 * The Drafts center shows a chat inside an iframe, where the composer's
 * "fullscreen" can only fill the frame. The composer reports its state to the
 * embedding page, which then lets the frame cover the whole viewport.
 *
 * Widening the frame can cross the 900px layout breakpoint, which would remount
 * the composer and lose staged attachments, the draft buffer and the expansion.
 * The session view therefore freezes its layout while the composer is expanded
 * (`useFrozenPhoneLayout`), fed by the small store below.
 */
export const COMPOSER_FULLSCREEN_MESSAGE = 'oriso:composer-fullscreen';

export interface ComposerFullscreenMessage {
	type: typeof COMPOSER_FULLSCREEN_MESSAGE;
	expanded: boolean;
}

let embeddedComposerExpanded = false;
const expandedListeners = new Set<() => void>();

export const subscribeEmbeddedComposerExpanded = (listener: () => void) => {
	expandedListeners.add(listener);
	return () => {
		expandedListeners.delete(listener);
	};
};

export const getEmbeddedComposerExpanded = () => embeddedComposerExpanded;

export const setEmbeddedComposerExpanded = (expanded: boolean) => {
	if (embeddedComposerExpanded !== expanded) {
		embeddedComposerExpanded = expanded;
		expandedListeners.forEach((listener) => listener());
	}
};

export const postComposerFullscreen = (expanded: boolean) => {
	if (typeof window === 'undefined' || window.parent === window) {
		return;
	}
	setEmbeddedComposerExpanded(expanded);
	const message: ComposerFullscreenMessage = {
		type: COMPOSER_FULLSCREEN_MESSAGE,
		expanded
	};
	window.parent.postMessage(message, window.location.origin);
};

export const isComposerFullscreenMessage = (
	data: unknown
): data is ComposerFullscreenMessage =>
	typeof data === 'object' &&
	data !== null &&
	(data as ComposerFullscreenMessage).type === COMPOSER_FULLSCREEN_MESSAGE &&
	typeof (data as ComposerFullscreenMessage).expanded === 'boolean';

/**
 * The phone/desktop decision of the session view, held at its value from before
 * the embedded composer expanded until the frame is back at its original width,
 * so widening the frame never remounts the composer.
 */
export const useFrozenPhoneLayout = (livePhoneLayout: boolean): boolean => {
	const expanded = useSyncExternalStore(
		subscribeEmbeddedComposerExpanded,
		getEmbeddedComposerExpanded
	);
	const frozen = useRef<boolean | null>(null);
	if (expanded) {
		if (frozen.current === null) {
			frozen.current = livePhoneLayout;
		}
	} else if (frozen.current === livePhoneLayout) {
		frozen.current = null;
	}
	return frozen.current ?? livePhoneLayout;
};
