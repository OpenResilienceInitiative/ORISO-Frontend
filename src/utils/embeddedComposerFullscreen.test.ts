import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	COMPOSER_FULLSCREEN_MESSAGE,
	isComposerFullscreenMessage,
	postComposerFullscreen,
	reportComposerExpanded,
	resetComposerExpandedOwners,
	announceComposerStateOnLoad
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

	describe('reportComposerExpanded', () => {
		const inFrame = () => {
			const post = vi.fn();
			vi.stubGlobal('window', {
				location: { origin: 'https://app.test' },
				parent: { postMessage: post }
			});
			return post;
		};
		const expandedValues = (post: ReturnType<typeof vi.fn>) =>
			post.mock.calls.map(([message]) => message.expanded);

		afterEach(() => {
			resetComposerExpandedOwners();
			vi.unstubAllGlobals();
		});

		it('keeps the frame fullscreen while another composer mounts and unmounts collapsed', () => {
			const post = inFrame();
			reportComposerExpanded('main', true);
			reportComposerExpanded('side', false); // initial state of a new composer
			reportComposerExpanded('side', false); // and its unmount
			expect(expandedValues(post)).toEqual([true]);
		});

		it('releases the frame only when the last expanded owner collapses', () => {
			const post = inFrame();
			reportComposerExpanded('main', true);
			reportComposerExpanded('side', true);
			reportComposerExpanded('main', false);
			expect(expandedValues(post)).toEqual([true]);
			reportComposerExpanded('side', false);
			expect(expandedValues(post)).toEqual([true, false]);
		});

		it('announces the current state when the frame has loaded', () => {
			const post = inFrame();
			const listeners: Record<string, () => void> = {};
			vi.stubGlobal('window', {
				location: { origin: 'https://app.test' },
				parent: { postMessage: post },
				addEventListener: (type: string, fn: () => void) => {
					listeners[type] = fn;
				}
			});
			vi.stubGlobal('document', { readyState: 'loading' });
			announceComposerStateOnLoad();
			reportComposerExpanded('main', true); // expanded before the load event
			post.mockClear();
			listeners.load();
			expect(expandedValues(post)).toEqual([true]);
			vi.unstubAllGlobals();
		});
	});
});
