import { describe, expect, it } from 'vitest';
import { resolveComposerMessageSnapshot } from './composerMessageSnapshot';

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
});
