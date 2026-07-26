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

describe('formatMatrixTimelineEvent mentions relation (m.mentions)', () => {
	it('exposes mentionedUserIds for a received event carrying m.mentions', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({
				'msgtype': 'm.text',
				'body': 'Hallo @Anna',
				'm.mentions': { user_ids: ['@anna:hs'] }
			}),
			null,
			'verschlüsselt'
		);
		expect(formatted.mentionedUserIds).toEqual(['@anna:hs']);
	});

	it('leaves normal messages untouched (no mentions key)', () => {
		const formatted = formatMatrixTimelineEvent(
			makeEvent({ msgtype: 'm.text', body: 'hallo' }),
			null,
			'verschlüsselt'
		);
		expect(formatted.mentionedUserIds).toBeUndefined();
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

describe('formatMatrixTimelineEvent m.image dimensions (WP-4)', () => {
	it('threads intrinsic w/h into the attachment for scaled thumbnails', () => {
		const message = formatMatrixTimelineEvent(
			makeEvent({
				msgtype: 'm.image',
				body: 'photo.png',
				file: { url: 'mxc://hs/media-1' },
				info: { mimetype: 'image/png', size: 512, w: 120, h: 72 }
			}),
			null,
			'encrypted'
		);

		expect(message.attachments[0]).toMatchObject({
			type: 'image',
			image_w: 120,
			image_h: 72
		});
	});

	it('omits dimensions when the sender did not provide them', () => {
		const message = formatMatrixTimelineEvent(
			makeEvent({
				msgtype: 'm.image',
				body: 'photo.png',
				file: { url: 'mxc://hs/media-2' },
				info: { mimetype: 'image/png', size: 512 }
			}),
			null,
			'encrypted'
		);

		expect(message.attachments[0]).not.toHaveProperty('image_w');
		expect(message.attachments[0]).not.toHaveProperty('image_h');
	});

	it('threads through only a blocked media-check verdict', () => {
		const blocked = formatMatrixTimelineEvent(
			makeEvent({
				msgtype: 'm.image',
				body: 'blocked.png',
				file: { url: 'mxc://hs/media-3' },
				info: {
					'mimetype': 'image/png',
					'org.oriso.media_check_state': 'blocked'
				}
			}),
			null,
			'encrypted'
		);
		const selfAssertedSafe = formatMatrixTimelineEvent(
			makeEvent({
				msgtype: 'm.image',
				body: 'safe.png',
				file: { url: 'mxc://hs/media-4' },
				info: {
					'mimetype': 'image/png',
					'org.oriso.media_check_state': 'safe'
				}
			}),
			null,
			'encrypted'
		);

		expect(blocked.attachments[0].media_check_state).toBe('blocked');
		expect(selfAssertedSafe.attachments[0]).not.toHaveProperty(
			'media_check_state'
		);
	});
});
