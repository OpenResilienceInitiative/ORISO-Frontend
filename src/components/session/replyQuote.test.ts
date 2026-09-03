// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	buildEditContext,
	buildReplyQuoteContext,
	buildReplyQuotePreview,
	REPLY_QUOTE_PREVIEW_MAX_LENGTH
} from './replyQuote';

const RAW_TOKEN_PATTERN = /\[\[|\[\/|\[hl:|\[align:/;

const alignedMessage = {
	_id: '$event:matrix.test',
	displayName: 'sabine98',
	username: 'sabine98',
	message:
		'[[align:left]]<p>Hallo, ich bin ungewollt schwanger.</p>[[/align]]'
};

describe('buildReplyQuoteContext (#978)', () => {
	it('renders the quote preview without any raw alignment markup', () => {
		const quote = buildReplyQuoteContext(alignedMessage);

		expect(quote.text).toBe('Hallo, ich bin ungewollt schwanger.');
		expect(quote.text).not.toMatch(RAW_TOKEN_PATTERN);
		expect(quote.eventId).toBe('$event:matrix.test');
		expect(quote.author).toBe('sabine98');
	});

	it('drops highlight tokens and ORISO prefixes as well', () => {
		const quote = buildReplyQuoteContext({
			_id: '1',
			username: 'consultant',
			message:
				'[VISIBLE_TO:abc][[align:center]]<p>[[hl:#ffff00]]wichtig[[/hl]]</p>[[/align]]'
		});

		expect(quote.text).toBe('wichtig');
		expect(quote.text).not.toMatch(RAW_TOKEN_PATTERN);
	});

	it('falls back to the username when no display name is set', () => {
		expect(
			buildReplyQuoteContext({
				_id: '1',
				username: 'consultant',
				message: 'plain'
			}).author
		).toBe('consultant');
	});
});

describe('buildReplyQuotePreview (#978)', () => {
	it('strips markup and caps the in-bubble preview length', () => {
		const preview = buildReplyQuotePreview({
			username: 'sabine98',
			message: `[[align:left]]<p>${'a'.repeat(400)}</p>[[/align]]`
		});

		expect(preview.text).toHaveLength(REPLY_QUOTE_PREVIEW_MAX_LENGTH);
		expect(preview.text).not.toMatch(RAW_TOKEN_PATTERN);
	});
});

describe('buildEditContext (#978)', () => {
	it('hands the composer editor HTML instead of transport tokens', () => {
		const edit = buildEditContext(alignedMessage);

		expect(edit.text).not.toMatch(RAW_TOKEN_PATTERN);
		expect(edit.text).toContain('text-align: left');
		expect(edit.text).toContain('Hallo, ich bin ungewollt schwanger.');
	});

	it('does not leak tokens for an attachment-only body', () => {
		const edit = buildEditContext({
			_id: '2',
			username: 'consultant',
			message: '[[align:left]]voice-message-123-s10.webm[[/align]]'
		});

		expect(edit.text).not.toMatch(RAW_TOKEN_PATTERN);
		expect(edit.text).toContain('voice-message-123-s10.webm');
	});
});
