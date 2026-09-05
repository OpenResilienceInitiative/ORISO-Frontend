import { describe, expect, it } from 'vitest';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import {
	getLatestMatrixRoomPreview,
	getPreviewLastMessageType
} from './matrixRoomPreview';

const event = (type: string, content: Record<string, unknown>, ts: number) => ({
	getType: () => type,
	getClearContent: () => content,
	getContent: () => content,
	getTs: () => ts
});

describe('getLatestMatrixRoomPreview', () => {
	it('suppresses a stale backend alias for Matrix-derived previews', () => {
		expect(getPreviewLastMessageType(true, 'FURTHER_STEPS')).toBeNull();
		expect(getPreviewLastMessageType(false, 'FURTHER_STEPS')).toBe(
			'FURTHER_STEPS'
		);
	});
	it('shows the newest actual text message instead of a legacy alias', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: 'Erster Text' },
					1
				),
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: 'So geht es wirklich weiter' },
					2
				)
			])
		).toEqual({ kind: 'text', text: 'So geht es wirklich weiter' });
	});

	it('converts rich transport markup into a readable one-line preview', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						msgtype: 'm.text',
						body: '[[align:left]]<p>Wir haben die Zwei-Minuten-Runde ausprobiert.</p>[[/align]]'
					},
					3
				)
			])
		).toEqual({
			kind: 'text',
			text: 'Wir haben die Zwei-Minuten-Runde ausprobiert.'
		});
	});

	it('skips markup-only events in favour of an older readable preview', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: 'Ältere lesbare Nachricht' },
					1
				),
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: '[[align:left]][[/align]]' },
					2
				)
			])
		).toEqual({ kind: 'text', text: 'Ältere lesbare Nachricht' });
	});

	it('shows an Erstantwort kind instead of the raw FIRST_RESPONSE JSON', () => {
		const body = `${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
			type: 'FIRST_RESPONSE',
			version: 1,
			bausteine: [
				{
					id: 'greeting',
					body: 'Schön, dass Sie sich gemeldet haben.'
				}
			]
		})}`;

		expect(
			getLatestMatrixRoomPreview([
				event('m.room.message', { msgtype: 'm.text', body }, 5)
			])
		).toEqual({ kind: 'first_response', text: null });
	});

	it('uses an Element-style semantic preview for voice messages', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						'msgtype': 'm.audio',
						'body': 'voice-message.ogg',
						'org.matrix.msc3245.voice': {}
					},
					3
				)
			])
		).toEqual({ kind: 'voice', text: null });
	});

	it('ignores edits, reactions and redactions as standalone previews', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: 'Sichtbarer Text' },
					1
				),
				event('m.reaction', {}, 2),
				event(
					'm.room.message',
					{
						'msgtype': 'm.text',
						'body': 'Edit',
						'm.relates_to': { rel_type: 'm.replace' }
					},
					3
				),
				event('m.room.redaction', {}, 4)
			])
		).toEqual({ kind: 'text', text: 'Sichtbarer Text' });
	});
});

describe('channel of the latest preview (B2 / T24 list prefix)', () => {
	it('marks a thread reply (m.thread relation) as the thread channel', () => {
		expect(
			getLatestMatrixRoomPreview([
				event('m.room.message', { msgtype: 'm.text', body: 'Root' }, 1),
				event(
					'm.room.message',
					{
						'msgtype': 'm.text',
						'body': 'Antwort im Thread',
						'm.relates_to': {
							rel_type: 'm.thread',
							event_id: '$root'
						}
					},
					2
				)
			])
		).toEqual({
			kind: 'text',
			text: 'Antwort im Thread',
			channel: 'thread'
		});
	});

	it('leaves a plain main-chat message without a channel', () => {
		expect(
			getLatestMatrixRoomPreview([
				event('m.room.message', { msgtype: 'm.text', body: 'Hallo' }, 1)
			])
		).toEqual({ kind: 'text', text: 'Hallo' });
	});

	it('keeps the channel on non-text kinds too', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						'msgtype': 'm.image',
						'body': 'foto.png',
						'm.relates_to': {
							rel_type: 'm.thread',
							event_id: '$root'
						}
					},
					1
				)
			])
		).toEqual({ kind: 'image', text: null, channel: 'thread' });
	});
});
