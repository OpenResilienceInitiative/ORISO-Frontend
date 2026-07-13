/**
 * Relations foundation (#435) — timeline formatter reply coverage.
 */

import { describe, it, expect } from 'vitest';
import { formatMatrixTimelineEvent } from './matrixTimelineEventFormatter';

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
