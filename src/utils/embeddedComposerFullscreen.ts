/**
 * The Drafts center shows a chat inside an iframe, where the composer's
 * "fullscreen" can only fill the frame. The composer reports its state to the
 * embedding page, which then lets the frame cover the whole viewport.
 */
export const COMPOSER_FULLSCREEN_MESSAGE = 'oriso:composer-fullscreen';

export interface ComposerFullscreenMessage {
	type: typeof COMPOSER_FULLSCREEN_MESSAGE;
	expanded: boolean;
}

export const postComposerFullscreen = (expanded: boolean) => {
	if (typeof window === 'undefined' || window.parent === window) {
		return;
	}
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
 * Widening the frame can cross the 900px layout breakpoint, which remounts the
 * composer (thread panel moves into the card). An expanded composer that
 * unmounts leaves a claim for its successor (same composer key) in the same commit; only when no
 * successor takes it is the frame released.
 */
let pendingExpansionKey: string | null = null;

/** `key` names the composer (room + thread) so only its twin can take over. */
export const releaseExpandedComposerOnUnmount = (key: string) => {
	pendingExpansionKey = key;
	setTimeout(() => {
		if (pendingExpansionKey === key) {
			pendingExpansionKey = null;
			postComposerFullscreen(false);
		}
	}, 0);
};

/** True once, and only for the composer with the released composer's key. */
export const claimRemountedComposerExpansion = (key: string): boolean => {
	if (pendingExpansionKey !== key) {
		return false;
	}
	pendingExpansionKey = null;
	return true;
};
