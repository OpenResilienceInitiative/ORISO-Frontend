import { describe, expect, it } from 'vitest';
import { sanitizeConsentHtml, sanitizeLegalHtml } from './legalHtmlSanitizer';

/**
 * `htmlParser` — the rendering path every authored legal string goes through —
 * replaces any node whose class is exactly `remove` with an empty fragment.
 * Inside a long policy document that is a deliberate authoring tool. Inside a
 * consent sentence it is a way for the author to delete the policy links while
 * still passing the server's mandatory-`{{legal_links}}` validation, which
 * would defeat the one technical protection ADR-021 decision 2 gives the
 * platform's mandatory disclosures.
 *
 * The two allowlists therefore differ by exactly one attribute.
 */
describe('legal vs. consent sanitizer', () => {
	const WITH_CLASS =
		'<span class="remove"><a href="https://oriso.test/dse">DSE</a></span>';

	it('keeps class in a legal document, where the remove convention belongs', () => {
		expect(sanitizeLegalHtml(WITH_CLASS)).toContain('class="remove"');
	});

	it('drops class from a consent sentence', () => {
		const result = sanitizeConsentHtml(WITH_CLASS);
		expect(result).not.toContain('class');
		expect(result).not.toContain('remove');
	});

	it('drops any class, not just the one parser convention', () => {
		expect(
			sanitizeConsentHtml('<p class="anything">Ich willige ein.</p>')
		).not.toContain('class');
	});

	it('keeps the anchor and its link attributes, which the consent needs', () => {
		const result = sanitizeConsentHtml(WITH_CLASS);
		expect(result).toContain('href="https://oriso.test/dse"');
		expect(result).toContain('DSE');
	});

	it('still strips scripts and event handlers', () => {
		const result = sanitizeConsentHtml(
			'<script>x()</script><img src="https://oriso.test/x.png" onerror="x()">'
		);
		expect(result).not.toContain('script');
		expect(result).not.toContain('onerror');
	});

	it('maps empty input to an empty string rather than throwing', () => {
		expect(sanitizeConsentHtml(null)).toBe('');
		expect(sanitizeConsentHtml(undefined)).toBe('');
		expect(sanitizeLegalHtml('')).toBe('');
	});
});

describe('consent sentences carry no remote images', () => {
	it('strips img entirely, so nothing loads before consent is given', () => {
		const withPixel =
			'<p>Ich willige ein.<img src="https://tracker.example/p.gif" alt="" /></p>';

		const sanitized = sanitizeConsentHtml(withPixel);

		// A consent sentence renders automatically during registration. An image
		// would make the browser contact a third party — collecting the
		// help-seeker's IP at the moment they have agreed to nothing.
		expect(sanitized).not.toContain('<img');
		expect(sanitized).not.toContain('tracker.example');
		expect(sanitized).toContain('Ich willige ein.');
	});

	it('still allows images inside a full legal document', () => {
		// A policy is opened deliberately, so the same rule does not apply.
		expect(
			sanitizeLegalHtml(
				'<p><img src="https://cdn.example/logo.png" /></p>'
			)
		).toContain('<img');
	});
});
