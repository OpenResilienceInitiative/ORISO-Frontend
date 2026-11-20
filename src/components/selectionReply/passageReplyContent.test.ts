import { describe, expect, it } from 'vitest';

import {
	buildPassageRepliesContent,
	getPassageReplies,
	getPassageRepliesText,
	MAX_EXCERPT_LENGTH,
	MAX_PASSAGE_REPLIES,
	PASSAGE_REPLIES_KEY,
	PASSAGE_REPLIES_TEXT_KEY,
	type PassageReplyContentItem
} from './passageReplyContent';

const labels = { voice: (sec: number) => `[Voice message ${sec}s]` };

const encryptedFile = {
	url: 'mxc://oriso.invalid/clip',
	key: {
		alg: 'A256CTR',
		ext: true,
		k: 'secret',
		key_ops: ['encrypt', 'decrypt'],
		kty: 'oct'
	},
	iv: 'iv',
	hashes: { sha256: 'hash' },
	v: 'v2' as const
};

const textReply: PassageReplyContentItem = {
	eventId: '$client',
	author: 'Lena',
	excerpt: 'drei Mahnungen',
	start: 12,
	text: 'Die schauen wir uns an.'
};

const voiceReply: PassageReplyContentItem = {
	eventId: '$client',
	author: 'Lena',
	excerpt: 'Brief vom Amtsgericht',
	audio: {
		file: encryptedFile,
		mimetype: 'audio/webm',
		durationMs: 48000,
		size: 512
	}
};

describe('buildPassageRepliesContent', () => {
	it('sends every answer in one m.text event with a readable fallback', () => {
		const content = buildPassageRepliesContent(
			[textReply, voiceReply],
			'  Bis morgen.  ',
			labels
		);

		expect(content.msgtype).toBe('m.text');
		expect(content.body).toBe(
			'> drei Mahnungen\nDie schauen wir uns an.\n\n' +
				'> Brief vom Amtsgericht\n[Voice message 48s]\n\n' +
				'Bis morgen.'
		);
		expect(content[PASSAGE_REPLIES_TEXT_KEY]).toBe('Bis morgen.');
		expect(content[PASSAGE_REPLIES_KEY]).toEqual([
			{
				event_id: '$client',
				author: 'Lena',
				excerpt: 'drei Mahnungen',
				start: 12,
				text: 'Die schauen wir uns an.'
			},
			{
				event_id: '$client',
				author: 'Lena',
				excerpt: 'Brief vom Amtsgericht',
				audio: {
					file: encryptedFile,
					mimetype: 'audio/webm',
					duration_ms: 48000,
					size: 512
				}
			}
		]);
	});

	it('carries no reply relation: one event answers several messages', () => {
		const content = buildPassageRepliesContent([textReply], '', labels);
		expect(content['m.relates_to']).toBeUndefined();
		expect(content[PASSAGE_REPLIES_TEXT_KEY]).toBeUndefined();
	});

	it('cuts an overlong excerpt', () => {
		const content = buildPassageRepliesContent(
			[{ ...textReply, excerpt: 'x'.repeat(MAX_EXCERPT_LENGTH + 50) }],
			'',
			labels
		);
		const [stored] = content[PASSAGE_REPLIES_KEY] as any[];
		expect(stored.excerpt).toHaveLength(MAX_EXCERPT_LENGTH);
	});
});

describe('getPassageReplies', () => {
	it('reads back what was sent', () => {
		const content = buildPassageRepliesContent(
			[textReply, voiceReply],
			'Bis morgen.',
			labels
		);
		expect(getPassageReplies(content)).toEqual([
			{ ...textReply, audio: null },
			{ ...voiceReply, start: null }
		]);
		expect(getPassageRepliesText(content)).toBe('Bis morgen.');
	});

	it('returns null for an ordinary message', () => {
		expect(getPassageReplies({ msgtype: 'm.text', body: 'Hallo' })).toBe(
			null
		);
		expect(getPassageRepliesText({ body: 'Hallo' })).toBe('');
	});

	it('drops malformed entries and answers without text or voice', () => {
		const replies = getPassageReplies({
			[PASSAGE_REPLIES_KEY]: [
				null,
				{ event_id: '$a', excerpt: 'x' },
				{ event_id: 7, excerpt: 'x', text: 'y' },
				{ event_id: '$b', excerpt: '', text: 'y' },
				{
					event_id: '$c',
					excerpt: 'x',
					audio: { file: { url: 'https://evil.invalid/a' } }
				},
				{ event_id: '$d', excerpt: 'kept', text: 'ok', start: -3 }
			]
		});
		expect(replies).toEqual([
			{
				eventId: '$d',
				author: '',
				excerpt: 'kept',
				start: null,
				text: 'ok',
				audio: null
			}
		]);
	});

	it('reads at most MAX_PASSAGE_REPLIES answers', () => {
		const many = Array.from(
			{ length: MAX_PASSAGE_REPLIES + 5 },
			(_, i) => ({
				event_id: `$m${i}`,
				excerpt: 'x',
				text: 'y'
			})
		);
		expect(getPassageReplies({ [PASSAGE_REPLIES_KEY]: many })).toHaveLength(
			MAX_PASSAGE_REPLIES
		);
	});
});
