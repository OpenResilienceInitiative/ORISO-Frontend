/**
 * Relations foundation (#435) — reply via `m.relates_to`/`m.in_reply_to`.
 * Pure-helper spec: content building, relation reading, legacy-fallback
 * stripping. Matrix spec semantics; SDK-free so it runs in node env.
 */

import { describe, it, expect } from 'vitest';
import {
	buildTextMessageContent,
	getReplyToEventId,
	getThreadRootId,
	stripReplyFallback
} from './messageRelations';

describe('reply relations (m.relates_to / m.in_reply_to)', () => {
	describe('buildTextMessageContent', () => {
		it('builds plain m.text content without a relation by default', () => {
			expect(buildTextMessageContent('hallo')).toEqual({
				msgtype: 'm.text',
				body: 'hallo'
			});
			expect(
				buildTextMessageContent('hallo', { replyToEventId: null })
			).toEqual({ msgtype: 'm.text', body: 'hallo' });
		});

		it('attaches the m.in_reply_to relation when replying', () => {
			expect(
				buildTextMessageContent('antwort', {
					replyToEventId: '$abc:matrix.oriso.org'
				})
			).toEqual({
				'msgtype': 'm.text',
				'body': 'antwort',
				'm.relates_to': {
					'm.in_reply_to': { event_id: '$abc:matrix.oriso.org' }
				}
			});
		});
	});

	describe('getReplyToEventId', () => {
		it('reads the replied-to event id from content', () => {
			expect(
				getReplyToEventId({
					'msgtype': 'm.text',
					'body': 'x',
					'm.relates_to': {
						'm.in_reply_to': { event_id: '$abc:hs' }
					}
				})
			).toBe('$abc:hs');
		});

		it('returns null for non-reply content and junk shapes', () => {
			expect(getReplyToEventId({ msgtype: 'm.text', body: 'x' })).toBe(
				null
			);
			expect(getReplyToEventId(undefined)).toBe(null);
			expect(
				getReplyToEventId({ 'm.relates_to': { rel_type: 'm.thread' } })
			).toBe(null);
			expect(
				getReplyToEventId({ 'm.relates_to': { 'm.in_reply_to': {} } })
			).toBe(null);
		});

		it('does not confuse a thread relation with a reply', () => {
			// MSC3440: thread events may carry BOTH rel_type m.thread and a
			// (fallback) m.in_reply_to — reading the reply id must still work,
			// but a pure thread relation without in_reply_to is not a reply.
			expect(
				getReplyToEventId({
					'm.relates_to': {
						'rel_type': 'm.thread',
						'event_id': '$root:hs',
						'm.in_reply_to': { event_id: '$last:hs' }
					}
				})
			).toBe('$last:hs');
		});
	});

	describe('stripReplyFallback', () => {
		it('removes the legacy quoted fallback block from Element clients', () => {
			const body =
				'> <@anna:hs> die ursprüngliche Nachricht\n> zweite Zeile\n\nDie eigentliche Antwort';
			expect(stripReplyFallback(body)).toBe('Die eigentliche Antwort');
		});

		it('leaves bodies without a fallback untouched', () => {
			expect(stripReplyFallback('ganz normale Nachricht')).toBe(
				'ganz normale Nachricht'
			);
			expect(stripReplyFallback('> nur ein Zitat ohne Leerzeile')).toBe(
				'> nur ein Zitat ohne Leerzeile'
			);
		});

		it('tolerates empty/undefined input', () => {
			expect(stripReplyFallback('')).toBe('');
			expect(stripReplyFallback(undefined as any)).toBe('');
		});
	});
});

describe('thread relations (MSC3440 m.thread)', () => {
	it('builds a thread relation with reply fallback to the root', () => {
		expect(
			buildTextMessageContent('thread-antwort', {
				threadRootId: '$root:hs'
			})
		).toEqual({
			'msgtype': 'm.text',
			'body': 'thread-antwort',
			'm.relates_to': {
				'rel_type': 'm.thread',
				'event_id': '$root:hs',
				'is_falling_back': true,
				'm.in_reply_to': { event_id: '$root:hs' }
			}
		});
	});

	it('reply INSIDE a thread targets the replied event, not the root', () => {
		expect(
			buildTextMessageContent('reply-in-thread', {
				threadRootId: '$root:hs',
				replyToEventId: '$msg:hs'
			})
		).toEqual({
			'msgtype': 'm.text',
			'body': 'reply-in-thread',
			'm.relates_to': {
				'rel_type': 'm.thread',
				'event_id': '$root:hs',
				'is_falling_back': false,
				'm.in_reply_to': { event_id: '$msg:hs' }
			}
		});
	});

	it('getThreadRootId reads the thread root from a relation', () => {
		expect(
			getThreadRootId({
				'm.relates_to': {
					'rel_type': 'm.thread',
					'event_id': '$root:hs',
					'm.in_reply_to': { event_id: '$x:hs' }
				}
			})
		).toBe('$root:hs');
		expect(getThreadRootId({ msgtype: 'm.text', body: 'x' })).toBe(null);
		expect(
			getThreadRootId({
				'm.relates_to': {
					'm.in_reply_to': { event_id: '$x:hs' }
				}
			})
		).toBe(null);
		expect(getThreadRootId(undefined)).toBe(null);
	});

	it('a plain reply stays a plain reply (no thread rel_type)', () => {
		const content = buildTextMessageContent('nur reply', {
			replyToEventId: '$orig:hs'
		});
		expect((content['m.relates_to'] as any).rel_type).toBeUndefined();
	});
});
