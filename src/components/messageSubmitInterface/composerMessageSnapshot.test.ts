import { describe, expect, it } from 'vitest';
import {
	resolveComposerMessageSnapshot,
	shouldPreserveComposerAfterRetry
} from './composerMessageSnapshot';

describe('resolveComposerMessageSnapshot', () => {
	it('falls back to composer state when the live editor snapshot is empty', () => {
		expect(
			resolveComposerMessageSnapshot(
				'<p></p>',
				'<p>Queued counselor reply</p>'
			)
		).toBe('<p>Queued counselor reply</p>');
	});

	it('prefers the live editor snapshot when it contains text', () => {
		expect(
			resolveComposerMessageSnapshot(
				'<p>Live counselor reply</p>',
				'<p>Stale reply</p>'
			)
		).toBe('<p>Live counselor reply</p>');
	});

	it('treats non-breaking spaces as empty content', () => {
		expect(
			resolveComposerMessageSnapshot(
				'<p>&nbsp;</p>',
				'<p>Reply from state</p>'
			)
		).toBe('<p>Reply from state</p>');
	});

	it('preserves a different in-progress draft while retrying an older message', () => {
		expect(
			shouldPreserveComposerAfterRetry(
				'<p>My new draft</p>',
				'My failed message'
			)
		).toBe(true);
	});

	it('allows clearing when the composer still contains the retried message', () => {
		expect(
			shouldPreserveComposerAfterRetry(
				'<p>My failed message</p>',
				'My failed message'
			)
		).toBe(false);
	});

	it('compares encoded HTML entities consistently', () => {
		expect(
			shouldPreserveComposerAfterRetry('<p>A &amp; B</p>', 'A & B')
		).toBe(false);
	});

	it('does not throw on malformed or out-of-range numeric entities', () => {
		expect(() =>
			shouldPreserveComposerAfterRetry(
				'<p>Broken &#99999999; entity</p>',
				'Broken &#99999999; entity'
			)
		).not.toThrow();
	});
});
