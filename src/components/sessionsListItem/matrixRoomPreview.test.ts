import { describe, expect, it } from 'vitest';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import {
	filterVisibleMatrixPreviewEvents,
	getLatestMatrixRoomPreview,
	getLatestTimedMatrixRoomPreview,
	getPreviewLastMessageType,
	toListPreviewLine
} from './matrixRoomPreview';

const event = (
	type: string,
	content: Record<string, unknown>,
	ts: number,
	sender = '@someone:example.org'
) => ({
	getType: () => type,
	getClearContent: () => content,
	getContent: () => content,
	getSender: () => sender,
	getTs: () => ts
});

describe('filterVisibleMatrixPreviewEvents', () => {
	const privateEvent = event(
		'm.room.message',
		{ msgtype: 'm.text', body: '[VISIBLE_TO:alice]Private note' },
		1,
		'@supervisor:example.org'
	);

	it('keeps a restricted event for a named recipient', () => {
		expect(
			filterVisibleMatrixPreviewEvents(
				[privateEvent],
				['@alice:example.org']
			)
		).toEqual([privateEvent]);
	});

	it('keeps a restricted event for its sender', () => {
		expect(
			filterVisibleMatrixPreviewEvents(
				[privateEvent],
				['@supervisor:example.org']
			)
		).toEqual([privateEvent]);
	});

	it('removes a restricted event for every other viewer', () => {
		expect(
			filterVisibleMatrixPreviewEvents(
				[privateEvent],
				['@bob:example.org']
			)
		).toEqual([]);
	});

	it('does not equate qualified Matrix IDs from different homeservers', () => {
		const qualified = event(
			'm.room.message',
			{
				msgtype: 'm.text',
				body: '[VISIBLE_TO:@alice:one.example]Private note'
			},
			1,
			'@supervisor:one.example'
		);
		expect(
			filterVisibleMatrixPreviewEvents(
				[qualified],
				['@alice:two.example']
			)
		).toEqual([]);
	});

	it('handles redacted or non-text bodies without breaking the list', () => {
		const redacted = event('m.room.message', { body: {} }, 2);
		expect(
			filterVisibleMatrixPreviewEvents([redacted], ['@bob:example.org'])
		).toEqual([redacted]);
	});
});

describe('getLatestMatrixRoomPreview', () => {
	it('keeps the timestamp for a separately contracted side-room preview', () => {
		expect(
			getLatestTimedMatrixRoomPreview([
				event(
					'm.room.message',
					{ msgtype: 'm.text', body: 'Supervisionsantwort' },
					42
				)
			])
		).toEqual({ kind: 'text', text: 'Supervisionsantwort', ts: 42 });
	});
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

	it('carries the length of a voice message from its info.duration', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						'msgtype': 'm.audio',
						'body': 'voice-message.ogg',
						'info': { duration: 42_300, mimetype: 'audio/ogg' },
						'org.matrix.msc3245.voice': {}
					},
					3
				)
			])
		).toEqual({ kind: 'voice', text: null, durationMs: 42_300 });
	});

	it('ignores a duration that is not a usable number', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						'msgtype': 'm.audio',
						'body': 'voice-message.ogg',
						'info': { duration: '42' },
						'org.matrix.msc3245.voice': {}
					},
					3
				)
			])
		).toEqual({ kind: 'voice', text: null });
	});

	// ORISO's recorder sends a plain m.audio; the length travels in the file name.
	it('reads an ORISO voice recording and its length from the file name', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						msgtype: 'm.audio',
						body: 'voice-message-1758600000000-s42-ms42300.webm',
						info: { mimetype: 'audio/webm', size: 1234 }
					},
					3
				)
			])
		).toEqual({ kind: 'voice', text: null, durationMs: 42_000 });
	});

	it('keeps any other audio file as audio', () => {
		expect(
			getLatestMatrixRoomPreview([
				event(
					'm.room.message',
					{
						msgtype: 'm.audio',
						body: 'interview-s42-ms42300.webm',
						info: { mimetype: 'audio/webm' }
					},
					3
				)
			])
		).toEqual({ kind: 'audio', text: null });
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

describe('preview line of the list card (Frank, 16.09.: icons, not words)', () => {
	const translate = (key: string) =>
		({
			'e2ee.message.encryption.text': 'Verschlüsselte Nachricht',
			'sessionList.preview.image': 'Bild',
			'sessionList.preview.audio': 'Audionachricht',
			'sessionList.preview.channel.supervision': 'Supervision:'
		})[key] ?? `?${key}`;

	it('shows a thread reply as the thread glyph and the bare text', () => {
		expect(
			toListPreviewLine(
				{ kind: 'text', text: 'Ja, das passt.', channel: 'thread' },
				translate
			)
		).toEqual({ glyphs: ['thread'], text: 'Ja, das passt.' });
	});

	it('shows a voice message as the voice glyph and its length', () => {
		expect(
			toListPreviewLine(
				{ kind: 'voice', text: null, durationMs: 42_300 },
				translate
			)
		).toEqual({ glyphs: ['voice'], text: '0:42' });
		expect(
			toListPreviewLine(
				{ kind: 'voice', text: null, durationMs: 754_000 },
				translate
			)
		).toEqual({ glyphs: ['voice'], text: '12:34' });
		expect(
			toListPreviewLine(
				{ kind: 'voice', text: null, durationMs: 3_725_000 },
				translate
			)
		).toEqual({ glyphs: ['voice'], text: '1:02:05' });
	});

	it('shows the voice glyph alone when the length is unknown', () => {
		expect(
			toListPreviewLine({ kind: 'voice', text: null }, translate)
		).toEqual({ glyphs: ['voice'], text: '' });
	});

	it('marks a voice reply in a thread with both glyphs, thread first', () => {
		expect(
			toListPreviewLine(
				{
					kind: 'voice',
					text: null,
					channel: 'thread',
					durationMs: 5_000
				},
				translate
			)
		).toEqual({ glyphs: ['thread', 'voice'], text: '0:05' });
	});

	it('keeps the words for everything that has no glyph', () => {
		expect(
			toListPreviewLine({ kind: 'text', text: 'Hallo' }, translate)
		).toEqual({ glyphs: [], text: 'Hallo' });
		expect(
			toListPreviewLine({ kind: 'image', text: null }, translate)
		).toEqual({ glyphs: [], text: 'Bild' });
		expect(
			toListPreviewLine(
				{ kind: 'audio', text: null, durationMs: 9_000 },
				translate
			)
		).toEqual({ glyphs: [], text: 'Audionachricht' });
		expect(
			toListPreviewLine(
				{ kind: 'text', text: 'Notiz', channel: 'supervision' },
				translate
			)
		).toEqual({ glyphs: [], text: 'Supervision: Notiz' });
	});

	it('falls back to the encryption notice when nothing is readable', () => {
		expect(toListPreviewLine(null, translate)).toEqual({
			glyphs: [],
			text: 'Verschlüsselte Nachricht'
		});
		expect(
			toListPreviewLine({ kind: 'encrypted', text: null }, translate)
		).toEqual({ glyphs: [], text: 'Verschlüsselte Nachricht' });
	});
});
