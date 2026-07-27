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
	stripReplyFallback,
	buildEditContent,
	getReplaceTargetId,
	getEditedBody,
	buildReactionContent,
	getReactionTarget,
	aggregateReactions,
	applyMessageEdits
} from './messageRelations';

describe('buildTextMessageContent with mentions (#435)', () => {
	it('adds the m.mentions fragment when mentionedUserIds are given', () => {
		expect(
			buildTextMessageContent('Hallo @Anna', {
				mentionedUserIds: ['@anna:hs']
			})
		).toEqual({
			'msgtype': 'm.text',
			'body': 'Hallo @Anna',
			'm.mentions': { user_ids: ['@anna:hs'] }
		});
	});

	it('combines mentions with a reply relation', () => {
		expect(
			buildTextMessageContent('Danke @Anna', {
				replyToEventId: '$orig:hs',
				mentionedUserIds: ['@anna:hs']
			})
		).toEqual({
			'msgtype': 'm.text',
			'body': 'Danke @Anna',
			'm.relates_to': {
				'm.in_reply_to': { event_id: '$orig:hs' }
			},
			'm.mentions': { user_ids: ['@anna:hs'] }
		});
	});

	it('omits m.mentions entirely when there are no mentions', () => {
		const content = buildTextMessageContent('hallo');
		expect(content).not.toHaveProperty('m.mentions');
	});
});

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

describe('editing relations (m.replace)', () => {
	describe('buildEditContent', () => {
		it('builds a fallback body prefixed with "* " and an m.new_content', () => {
			expect(buildEditContent('korrigierter text', '$orig:hs')).toEqual({
				'msgtype': 'm.text',
				'body': '* korrigierter text',
				'm.new_content': {
					msgtype: 'm.text',
					body: 'korrigierter text'
				},
				'm.relates_to': {
					rel_type: 'm.replace',
					event_id: '$orig:hs'
				}
			});
		});
	});

	describe('getReplaceTargetId', () => {
		it('reads the edited event id from an m.replace relation', () => {
			expect(
				getReplaceTargetId({
					'm.relates_to': {
						rel_type: 'm.replace',
						event_id: '$orig:hs'
					}
				})
			).toBe('$orig:hs');
		});

		it('returns null for non-edit content and junk shapes', () => {
			expect(getReplaceTargetId({ msgtype: 'm.text', body: 'x' })).toBe(
				null
			);
			expect(getReplaceTargetId(undefined)).toBe(null);
			expect(
				getReplaceTargetId({
					'm.relates_to': { rel_type: 'm.thread', event_id: '$x:hs' }
				})
			).toBe(null);
		});
	});

	describe('getEditedBody', () => {
		it('reads the replacement body from m.new_content', () => {
			expect(
				getEditedBody({
					'msgtype': 'm.text',
					'body': '* korrigierter text',
					'm.new_content': {
						msgtype: 'm.text',
						body: 'korrigierter text'
					},
					'm.relates_to': {
						rel_type: 'm.replace',
						event_id: '$orig:hs'
					}
				})
			).toBe('korrigierter text');
		});

		it('returns null when there is no m.new_content', () => {
			expect(getEditedBody({ msgtype: 'm.text', body: 'x' })).toBe(null);
			expect(getEditedBody(undefined)).toBe(null);
		});
	});
});

describe('reaction relations (m.annotation)', () => {
	describe('buildReactionContent', () => {
		it('builds m.reaction content annotating the target event with a key', () => {
			expect(buildReactionContent('$msg:hs', '👍')).toEqual({
				'm.relates_to': {
					rel_type: 'm.annotation',
					event_id: '$msg:hs',
					key: '👍'
				}
			});
		});
	});

	describe('getReactionTarget', () => {
		it('reads the target event id and key from m.reaction content', () => {
			expect(
				getReactionTarget({
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: '$msg:hs',
						key: '👍'
					}
				})
			).toEqual({ eventId: '$msg:hs', key: '👍' });
		});

		it('returns null for non-annotation content and junk shapes', () => {
			expect(getReactionTarget({ msgtype: 'm.text', body: 'x' })).toBe(
				null
			);
			expect(getReactionTarget(undefined)).toBe(null);
			expect(
				getReactionTarget({
					'm.relates_to': { rel_type: 'm.replace', event_id: '$x:hs' }
				})
			).toBe(null);
		});
	});

	describe('aggregateReactions', () => {
		it('groups reactions by key, counts them, and marks the own reaction', () => {
			const reactions = [
				{
					eventId: '$r1:hs',
					senderId: '@anna:hs',
					content: buildReactionContent('$msg:hs', '👍')
				},
				{
					eventId: '$r2:hs',
					senderId: '@bob:hs',
					content: buildReactionContent('$msg:hs', '👍')
				},
				{
					eventId: '$r3:hs',
					senderId: '@me:hs',
					content: buildReactionContent('$msg:hs', '❤️')
				},
				{
					eventId: '$r4:hs',
					senderId: '@carla:hs',
					content: buildReactionContent('$other:hs', '👍')
				}
			];

			expect(aggregateReactions(reactions, '$msg:hs', '@me:hs')).toEqual([
				{
					key: '👍',
					count: 2,
					senderIds: ['@anna:hs', '@bob:hs'],
					ownEventId: null
				},
				{
					key: '❤️',
					count: 1,
					senderIds: ['@me:hs'],
					ownEventId: '$r3:hs'
				}
			]);
		});

		it('returns an empty array when there are no reactions for the target', () => {
			expect(aggregateReactions([], '$msg:hs', '@me:hs')).toEqual([]);
		});
	});
});

describe('applyMessageEdits', () => {
	it('replaces the body of the original message with the latest edit and drops the edit event', () => {
		const messages = [
			{ _id: '$orig:hs', ts: 1000, msg: 'erste version' },
			{
				_id: '$edit1:hs',
				ts: 2000,
				replaceTargetId: '$orig:hs',
				editedBody: 'zweite version'
			},
			{
				_id: '$edit2:hs',
				ts: 3000,
				replaceTargetId: '$orig:hs',
				editedBody: 'dritte version'
			}
		];

		expect(applyMessageEdits(messages)).toEqual([
			{
				_id: '$orig:hs',
				ts: 1000,
				msg: 'dritte version',
				isEdited: true
			}
		]);
	});

	it('leaves messages without an edit untouched', () => {
		const messages = [{ _id: '$orig:hs', ts: 1000, msg: 'unverändert' }];
		expect(applyMessageEdits(messages)).toEqual(messages);
	});

	it('drops an edit event that targets an unknown/out-of-window original', () => {
		const messages = [
			{
				_id: '$edit:hs',
				ts: 2000,
				replaceTargetId: '$missing:hs',
				editedBody: 'zu spät'
			}
		];
		expect(applyMessageEdits(messages)).toEqual([]);
	});
});
