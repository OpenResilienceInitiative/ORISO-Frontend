import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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

/**
 * Several composers can be mounted at once (main chat plus a side panel). Each
 * reports on its own; the frame stays fullscreen while ANY owner is expanded, so
 * a collapsed composer mounting or unmounting never releases another's state.
 */
const expandedOwners = new Set<string>();
let reportedExpanded = false;

export const reportComposerExpanded = (owner: string, expanded: boolean) => {
	if (expanded) {
		expandedOwners.add(owner);
	} else {
		expandedOwners.delete(owner);
	}
	const anyExpanded = expandedOwners.size > 0;
	if (anyExpanded !== reportedExpanded) {
		reportedExpanded = anyExpanded;
		postComposerFullscreen(anyExpanded);
	}
};

/**
 * A (re)loaded frame announces its own state once its document is complete, so
 * the embedding page never has to guess: a reload resets a stale fullscreen
 * (the new document starts collapsed), while an expansion reported before the
 * load event survives because the frame reports it again here.
 */
export const announceComposerStateOnLoad = () => {
	if (typeof window === 'undefined' || window.parent === window) {
		return;
	}
	const announce = () => postComposerFullscreen(reportedExpanded);
	if (document.readyState === 'complete') {
		announce();
	} else {
		window.addEventListener('load', announce, { once: true });
	}
};

announceComposerStateOnLoad();

/** Test isolation: owners are module state. */
export const resetComposerExpandedOwners = () => {
	expandedOwners.clear();
	reportedExpanded = false;
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
/** Time for the embedding page to shrink the frame back after a collapse. */
const FREEZE_SETTLE_MS = 400;

export const useFrozenPhoneLayout = (livePhoneLayout: boolean): boolean => {
	const expanded = useSyncExternalStore(
		subscribeEmbeddedComposerExpanded,
		getEmbeddedComposerExpanded
	);
	const frozen = useRef<boolean | null>(null);
	const [, settle] = useState(0);
	if (expanded) {
		if (frozen.current === null) {
			frozen.current = livePhoneLayout;
		}
	} else if (frozen.current === livePhoneLayout) {
		frozen.current = null;
	}
	// The window may have been resized while expanded, so the frame can come
	// back at a different breakpoint than it left: release after it settled.
	useEffect(() => {
		if (expanded || frozen.current === null) {
			return undefined;
		}
		const timer = setTimeout(() => {
			frozen.current = null;
			settle((tick) => tick + 1);
		}, FREEZE_SETTLE_MS);
		return () => clearTimeout(timer);
	}, [expanded]);
	return frozen.current ?? livePhoneLayout;
};
