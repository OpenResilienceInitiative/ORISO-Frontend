/**
 * Thread-panel-UX (#435) — pure summary computation extracted from
 * SessionItemComponent so it is unit-testable.
 */

import { describe, it, expect } from 'vitest';
import {
	computeThreadSummaries,
	formatThreadEntryPreview
} from './threadSummaries';

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
			rootPreview: 'Ursprüngliche Frage',
			lastReplyAuthor: '',
			lastReplyPreview: 'Zweite Antwort'
		});
	});

	// T21: the thread entry in the main chat shows who replied last and what.
	it('keeps the author and a plain-text preview of the last reply', () => {
		const messages = [
			{
				_id: '$root:hs',
				message: 'Root',
				messageTime: '2026-07-14T09:00:00.000Z'
			},
			{
				_id: '$reply1:hs',
				message: 'Erste Antwort',
				messageTime: '2026-07-14T09:01:00.000Z',
				threadRootEventId: '$root:hs',
				displayName: 'Mona S.',
				username: 'mona.s@oriso.invalid'
			},
			{
				_id: '$reply2:hs',
				message:
					'[[align:left]]<p>Okay, <b>nächste</b> Woche</p>[[/align]]',
				messageTime: '2026-07-14T09:02:00.000Z',
				threadRootEventId: '$root:hs',
				username: 'sonnenblume_47'
			}
		];

		const summary = computeThreadSummaries(messages).get('$root:hs')!;

		expect(summary.lastReplyAuthor).toBe('sonnenblume_47');
		expect(summary.lastReplyPreview).toBe('Okay, nächste Woche');
	});

	it('prefers the display name over the username for the last reply author', () => {
		const messages = [
			{
				_id: '$reply:hs',
				message: 'Antwort',
				messageTime: '2026-07-14T09:01:00.000Z',
				threadRootEventId: '$root:hs',
				displayName: 'Mona S.',
				username: 'mona.s@oriso.invalid'
			}
		];
		expect(
			computeThreadSummaries(messages).get('$root:hs')?.lastReplyAuthor
		).toBe('Mona S.');
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
			rootPreview: '',
			lastReplyAuthor: '',
			lastReplyPreview: 'Antwort ohne geladenen Root'
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

describe('formatThreadEntryPreview (T21: "Autor: letzte Nachricht" on the thread entry)', () => {
	it('joins author and preview on one line', () => {
		expect(
			formatThreadEntryPreview({
				lastReplyAuthor: 'Mona S.',
				lastReplyPreview: 'Zu den Briefen: alles in Ordnung.'
			})
		).toBe('Mona S.: Zu den Briefen: alles in Ordnung.');
	});

	it('truncates a long preview with an ellipsis at the given maximum', () => {
		const text = formatThreadEntryPreview(
			{ lastReplyAuthor: 'A', lastReplyPreview: 'x'.repeat(200) },
			40
		);
		expect(text.length).toBe(40);
		expect(text.endsWith('…')).toBe(true);
	});

	it('falls back to the preview alone without an author, and to empty without both', () => {
		expect(
			formatThreadEntryPreview({
				lastReplyAuthor: '',
				lastReplyPreview: 'Nur Text'
			})
		).toBe('Nur Text');
		expect(
			formatThreadEntryPreview({
				lastReplyAuthor: '',
				lastReplyPreview: ''
			})
		).toBe('');
	});
});
