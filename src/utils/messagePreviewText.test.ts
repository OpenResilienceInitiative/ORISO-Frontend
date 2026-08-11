import { describe, expect, it } from 'vitest';
import { toMessagePreviewText } from './messagePreviewText';

describe('toMessagePreviewText', () => {
	it('strips [[align:]] wrappers and HTML tags to plain text', () => {
		expect(
			toMessagePreviewText('[[align:left]]<p>hello testing</p>[[/align]]')
		).toBe('hello testing');
	});

	it('keeps plain text unchanged', () => {
		expect(toMessagePreviewText('okay')).toBe('okay');
	});

	it('unwraps highlight tokens and leaves readable text', () => {
		expect(
			toMessagePreviewText('[[hl:#ffff00]]important note[[/hl]]')
		).toBe('important note');
	});

	it('strips VISIBLE_TO prefixes before building the preview', () => {
		expect(
			toMessagePreviewText(
				'[VISIBLE_TO:abc][[align:left]]<p>secret</p>[[/align]]'
			)
		).toBe('secret');
	});

	it('collapses multiline HTML into a one-line preview', () => {
		expect(toMessagePreviewText('<p>hello</p><p>world</p>')).toBe(
			'hello world'
		);
	});

	it('returns empty string for empty / null input', () => {
		expect(toMessagePreviewText('')).toBe('');
		expect(toMessagePreviewText(null)).toBe('');
		expect(toMessagePreviewText(undefined)).toBe('');
	});
});
