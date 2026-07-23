import { describe, expect, it } from 'vitest';
import { transportMarkupToComposerHtml } from './transportMarkupToComposerHtml';

describe('transportMarkupToComposerHtml', () => {
	it('converts align tokens wrapping HTML into TipTap-compatible paragraphs', () => {
		expect(
			transportMarkupToComposerHtml(
				'[[align:left]]<p>hello</p>[[/align]]'
			)
		).toContain('text-align: left');
		expect(
			transportMarkupToComposerHtml(
				'[[align:left]]<p>hello</p>[[/align]]'
			)
		).toContain('hello');
		expect(
			transportMarkupToComposerHtml(
				'[[align:left]]<p>hello</p>[[/align]]'
			)
		).not.toContain('[[align');
	});

	it('wraps plain aligned text without exposing tokens', () => {
		const html = transportMarkupToComposerHtml(
			'[[align:left]]\nhello\n[[/align]]'
		);
		expect(html).toContain('hello');
		expect(html).not.toContain('[[align');
		expect(html).toContain('<p');
	});

	it('rehydrates highlight tokens as mark tags', () => {
		const html = transportMarkupToComposerHtml(
			'[[hl:yellow]]hi[[/hl]] there'
		);
		expect(html).toContain('<mark');
		expect(html).toContain('hi');
		expect(html).not.toContain('[[hl');
	});

	it('strips visibility prefixes before decoding', () => {
		const html = transportMarkupToComposerHtml(
			'[VISIBLE_TO:abc][[align:left]]<p>secret</p>[[/align]]'
		);
		expect(html).toContain('secret');
		expect(html).not.toContain('VISIBLE_TO');
	});
});
