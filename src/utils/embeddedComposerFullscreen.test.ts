import { describe, expect, it, vi } from 'vitest';
import {
	COMPOSER_FULLSCREEN_MESSAGE,
	isComposerFullscreenMessage,
	postComposerFullscreen
} from './embeddedComposerFullscreen';

describe('embeddedComposerFullscreen', () => {
	it('accepts only well-formed messages', () => {
		expect(
			isComposerFullscreenMessage({
				type: COMPOSER_FULLSCREEN_MESSAGE,
				expanded: true
			})
		).toBe(true);
		expect(
			isComposerFullscreenMessage({ type: 'other', expanded: true })
		).toBe(false);
		expect(
			isComposerFullscreenMessage({
				type: COMPOSER_FULLSCREEN_MESSAGE,
				expanded: 'yes'
			})
		).toBe(false);
		expect(isComposerFullscreenMessage(null)).toBe(false);
	});

	it('posts to the embedding page only from inside an iframe', () => {
		const post = vi.fn();
		const top: Record<string, unknown> = {
			location: { origin: 'https://app.test' }
		};
		top.parent = top;
		vi.stubGlobal('window', top);
		postComposerFullscreen(true);
		expect(post).not.toHaveBeenCalled();

		vi.stubGlobal('window', {
			location: { origin: 'https://app.test' },
			parent: { postMessage: post }
		});
		postComposerFullscreen(true);
		expect(post).toHaveBeenCalledWith(
			{ type: COMPOSER_FULLSCREEN_MESSAGE, expanded: true },
			'https://app.test'
		);
		vi.unstubAllGlobals();
	});
});
