/**
 * Relations foundation (#435) — timeline formatter reply coverage.
 */

import { describe, it, expect } from 'vitest';
import {
	formatMatrixTimelineEvent,
	extractReactionEvents
} from './matrixTimelineEventFormatter';

const makeEvent = (content: Record<string, unknown>) => ({
	getType: () => 'm.room.message',
	getContent: () => content,
	getSender: () => '@anna:hs',
	getId: () => '$msg:hs',
	getTs: () => 1700000000000
});

describe('formatMatrixTimelineEvent reply relation', () => {
	it('exposes replyToEventId and strips the legacy quote fallback', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({
				'msgtype': 'm.text',
				'body': '> <@bob:hs> original\n\nmeine antwort',
				'm.relates_to': {
					'm.in_reply_to': { event_id: '$orig:hs' }
				}
			}),
			null,
			'verschlüsselt'
		);
		expect(formatted.replyToEventId).toBe('$orig:hs');
		expect(formatted.msg).toBe('meine antwort');
	});

	it('leaves normal messages untouched (no reply key)', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({ msgtype: 'm.text', body: 'hallo' }),
			null,
			'verschlüsselt'
		);
		expect(formatted.replyToEventId).toBeUndefined();
		expect(formatted.msg).toBe('hallo');
	});
});

describe('formatMatrixTimelineEvent edit relation (m.replace)', () => {
	it('exposes replaceTargetId and editedBody for an edit event', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({
				'msgtype': 'm.text',
				'body': '* korrigiert',
				'm.new_content': { msgtype: 'm.text', body: 'korrigiert' },
				'm.relates_to': {
					rel_type: 'm.replace',
					event_id: '$orig:hs'
				}
			}),
			null,
			'verschlüsselt'
		);
		expect(formatted.replaceTargetId).toBe('$orig:hs');
		expect(formatted.editedBody).toBe('korrigiert');
	});

	it('leaves normal messages untouched (no edit keys)', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({ msgtype: 'm.text', body: 'hallo' }),
			null,
			'verschlüsselt'
		);
		expect(formatted.replaceTargetId).toBeUndefined();
		expect(formatted.editedBody).toBeUndefined();
	});
});

describe('extractReactionEvents', () => {
	const makeReactionEvent = (
		id: string,
		senderId: string,
		content: Record<string, unknown>
	) => ({
		getType: () => 'm.reaction',
		getId: () => id,
		getSender: () => senderId,
		getContent: () => content
	});

	it('picks m.reaction events out of a mixed raw event list', () => {
		const reaction = makeReactionEvent('$r1:hs', '@anna:hs', {
			'm.relates_to': {
				rel_type: 'm.annotation',
				event_id: '$msg:hs',
				key: '👍'
			}
		});
		const message = makeEvent({ msgtype: 'm.text', body: 'hallo' });

		expect(extractReactionEvents([message, reaction])).toEqual([
			{
				eventId: '$r1:hs',
				senderId: '@anna:hs',
				content: {
					'm.relates_to': {
						rel_type: 'm.annotation',
						event_id: '$msg:hs',
						key: '👍'
					}
				}
			}
		]);
	});

	it('returns an empty array when there are no reaction events', () => {
		expect(extractReactionEvents([makeEvent({ body: 'x' })])).toEqual([]);
		expect(extractReactionEvents([])).toEqual([]);
	});
});
