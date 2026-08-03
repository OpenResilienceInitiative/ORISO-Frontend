import { describe, expect, it } from 'vitest';
import { getLatestDecryptedMatrixMessage } from './matrixSessionPreview';

const event = (type: string, body?: string) => ({
	getType: () => type,
	getContent: () => (body === undefined ? {} : { body })
});

describe('getLatestDecryptedMatrixMessage', () => {
	it('returns the newest locally decrypted Matrix message', () => {
		expect(
			getLatestDecryptedMatrixMessage([
				event('m.room.message', 'older'),
				event('m.room.encrypted'),
				event('m.room.message', 'newest')
			])
		).toBe('newest');
	});

	it('keeps the protected fallback contract while events are encrypted', () => {
		expect(
			getLatestDecryptedMatrixMessage([
				event('m.room.encryption'),
				event('m.room.encrypted')
			])
		).toBeNull();
	});

	it('becomes readable after the SDK mutates an event on delayed decryption', () => {
		let type = 'm.room.encrypted';
		let content: Record<string, unknown> = {};
		const delayedEvent = {
			getType: () => type,
			getContent: () => content
		};

		expect(getLatestDecryptedMatrixMessage([delayedEvent])).toBeNull();
		type = 'm.room.message';
		content = { body: 'decrypted later' };
		expect(getLatestDecryptedMatrixMessage([delayedEvent])).toBe(
			'decrypted later'
		);
	});

	it('uses the clean replacement body for edited messages', () => {
		expect(
			getLatestDecryptedMatrixMessage([
				{
					getType: () => 'm.room.message',
					getContent: () => ({
						body: '* corrected text',
						'm.new_content': { body: 'corrected text' }
					})
				}
			])
		).toBe('corrected text');
	});

	it.each(['', '   '])(
		'falls back to the original body when the replacement is %j',
		(replacementBody) => {
			expect(
				getLatestDecryptedMatrixMessage([
					{
						getType: () => 'm.room.message',
						getContent: () => ({
							body: '* original text',
							'm.new_content': { body: replacementBody }
						})
					}
				])
			).toBe('* original text');
		}
	);
});
