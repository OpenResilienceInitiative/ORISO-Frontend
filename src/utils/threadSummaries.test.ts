/**
 * Thread-panel-UX (#435) — pure summary computation extracted from
 * SessionItemComponent so it is unit-testable.
 */

import { describe, it, expect } from 'vitest';
import { computeThreadSummaries } from './threadSummaries';

describe('computeThreadSummaries', () => {
	it('counts replies and tracks the last reply per thread root', () => {
		const messages = [
			{
				_id: '$root:hs',
				message: 'Ursprüngliche Frage',
				messageTime: '2026-07-14T09:00:00.000Z'
			},
			{
				_id: '$reply1:hs',
				message: 'Erste Antwort',
				messageTime: '2026-07-14T09:01:00.000Z',
				threadRootEventId: '$root:hs'
			},
			{
				_id: '$reply2:hs',
				message: 'Zweite Antwort',
				messageTime: '2026-07-14T09:02:00.000Z',
				threadRootEventId: '$root:hs'
			}
		];

		const summaries = computeThreadSummaries(messages);

		expect(summaries.get('$root:hs')).toEqual({
			rootId: '$root:hs',
			replyCount: 2,
			lastReplyTs: new Date('2026-07-14T09:02:00.000Z').getTime(),
			rootPreview: 'Ursprüngliche Frage'
		});
	});

	it('ignores a legacy [THREAD:rootId] prefix message that has no relation (ADR-017 hard cut)', () => {
		const messages = [
			{
				_id: '$root:hs',
				message: 'Root',
				messageTime: '2026-07-14T09:00:00.000Z'
			},
			{
				_id: '$reply:hs',
				message: '[THREAD:$root:hs] Legacy-Antwort',
				messageTime: '2026-07-14T09:01:00.000Z'
			}
		];

		// Thread identity comes solely from the m.thread relation now; a bare
		// prefix carries no thread semantics, so it produces no summary.
		expect(computeThreadSummaries(messages).size).toBe(0);
	});

	it('returns an empty map for a flat conversation with no thread replies', () => {
		const messages = [
			{
				_id: '$a:hs',
				message: 'hallo',
				messageTime: '2026-07-14T09:00:00.000Z'
			}
		];
		expect(computeThreadSummaries(messages).size).toBe(0);
	});

	it('leaves rootPreview empty when the root message is outside the loaded window', () => {
		const messages = [
			{
				_id: '$reply:hs',
				message: 'Antwort ohne geladenen Root',
				messageTime: '2026-07-14T09:01:00.000Z',
				threadRootEventId: '$missing-root:hs'
			}
		];

		const summaries = computeThreadSummaries(messages);

		expect(summaries.get('$missing-root:hs')).toEqual({
			rootId: '$missing-root:hs',
			replyCount: 1,
			lastReplyTs: new Date('2026-07-14T09:01:00.000Z').getTime(),
			rootPreview: ''
		});
	});

	it('stores a plain-text rootPreview for transport markup + HTML (#834)', () => {
		const messages = [
			{
				_id: '$root:hs',
				message: '[[align:left]]<p>hello testing</p>[[/align]]',
				messageTime: '2026-07-14T09:00:00.000Z'
			},
			{
				_id: '$reply:hs',
				message: 'Antwort',
				messageTime: '2026-07-14T09:01:00.000Z',
				threadRootEventId: '$root:hs'
			}
		];

		const summaries = computeThreadSummaries(messages);

		expect(summaries.get('$root:hs')?.rootPreview).toBe('hello testing');
		expect(summaries.get('$root:hs')?.rootPreview).not.toMatch(
			/\[\[align:|<p>/i
		);
	});
});
