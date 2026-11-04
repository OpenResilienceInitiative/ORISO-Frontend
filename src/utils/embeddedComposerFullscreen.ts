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
