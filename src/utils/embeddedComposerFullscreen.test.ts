import { describe, expect, it, vi } from 'vitest';
import {
	claimRemountedComposerExpansion,
	COMPOSER_FULLSCREEN_MESSAGE,
	isComposerFullscreenMessage,
	postComposerFullscreen,
	releaseExpandedComposerOnUnmount
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

	describe('expanded composer remount', () => {
		const inFrame = () => {
			const post = vi.fn();
			vi.stubGlobal('window', {
				location: { origin: 'https://app.test' },
				parent: { postMessage: post }
			});
			return post;
		};

		it('hands the expansion to the replacement composer without releasing the frame', () => {
			vi.useFakeTimers();
			const post = inFrame();
			releaseExpandedComposerOnUnmount();
			expect(claimRemountedComposerExpansion()).toBe(true);
			vi.runAllTimers();
			expect(post).not.toHaveBeenCalled();
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});

		it('releases the frame when no composer takes over', () => {
			vi.useFakeTimers();
			const post = inFrame();
			releaseExpandedComposerOnUnmount();
			vi.runAllTimers();
			expect(post).toHaveBeenCalledWith(
				{ type: COMPOSER_FULLSCREEN_MESSAGE, expanded: false },
				'https://app.test'
			);
			expect(claimRemountedComposerExpansion()).toBe(false);
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});
	});
});
