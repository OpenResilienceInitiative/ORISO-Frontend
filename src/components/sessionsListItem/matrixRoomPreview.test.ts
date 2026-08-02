import { describe, expect, it } from 'vitest';
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
