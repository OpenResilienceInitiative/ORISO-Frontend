import { describe, expect, it } from 'vitest';
import {
	normalizeLegalLang,
	pickConsentPrivacyContent,
	resolveLegalContent
} from './legalContent';

const map = (entries: Record<string, unknown>) => JSON.stringify(entries);

describe('normalizeLegalLang', () => {
	it('reduces i18n tags to the bare language code', () => {
		expect(normalizeLegalLang('de-DE')).toBe('de');
		expect(normalizeLegalLang('de@informal')).toBe('de');
		expect(normalizeLegalLang('EN')).toBe('en');
	});

	it('defaults to de when nothing is provided', () => {
		expect(normalizeLegalLang(undefined)).toBe('de');
		expect(normalizeLegalLang('')).toBe('de');
	});
});

describe('resolveLegalContent', () => {
	it('returns null for empty content', () => {
		expect(resolveLegalContent(null, 'de')).toBeNull();
		expect(resolveLegalContent(undefined, 'de')).toBeNull();
		expect(resolveLegalContent('', 'de')).toBeNull();
		expect(resolveLegalContent('   ', 'de')).toBeNull();
	});

	it('passes plain HTML through unchanged without notices', () => {
		const html = '<p>Datenschutz</p>';
		expect(resolveLegalContent(html, 'de-DE')).toEqual({
			html,
			lang: 'de',
			isMachineTranslated: false,
			originalLang: 'de'
		});
	});

	it('picks the UI language from a language map', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '<p>Hello</p>'
		});
		const resolved = resolveLegalContent(content, 'en');
		expect(resolved).toEqual({
			html: '<p>Hello</p>',
			lang: 'en',
			isMachineTranslated: false,
			originalLang: 'de'
		});
	});

	it('falls back to the original language when the UI language is missing', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '<p>Hello</p>'
		});
		const resolved = resolveLegalContent(content, 'fr');
		expect(resolved).toEqual({
			html: '<p>Hallo</p>',
			lang: 'de',
			isMachineTranslated: false,
			originalLang: 'de'
		});
	});

	it('flags machine translated content and keeps the original language', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '<p>Hello</p>',
			en__meta: JSON.stringify({
				mt: true,
				src: 'de',
				at: '2026-07-01T00:00:00Z'
			})
		});
		const resolved = resolveLegalContent(content, 'en');
		expect(resolved).toEqual({
			html: '<p>Hello</p>',
			lang: 'en',
			isMachineTranslated: true,
			originalLang: 'de'
		});
	});

	it('accepts meta values that are already objects', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '<p>Hello</p>',
			en__meta: { mt: true, src: 'de' }
		});
		expect(resolveLegalContent(content, 'en')?.isMachineTranslated).toBe(
			true
		);
	});

	it('never renders __meta keys as content', () => {
		const content = map({
			de__meta: JSON.stringify({ mt: true, src: 'en' }),
			en__meta: JSON.stringify({ mt: true, src: 'de' })
		});
		// map with only meta keys has no renderable content
		expect(resolveLegalContent(content, 'de')).toBeNull();
	});

	it('does not leak meta content when the ui language only exists as meta key', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en__meta: JSON.stringify({ mt: true, src: 'de' })
		});
		const resolved = resolveLegalContent(content, 'en');
		expect(resolved?.html).toBe('<p>Hallo</p>');
		expect(resolved?.lang).toBe('de');
	});

	it('derives the original language from mt metadata when de is machine translated', () => {
		const content = map({
			de: '<p>Hallo</p>',
			de__meta: JSON.stringify({ mt: true, src: 'en' }),
			en: '<p>Hello</p>'
		});
		const resolved = resolveLegalContent(content, 'de');
		expect(resolved).toEqual({
			html: '<p>Hallo</p>',
			lang: 'de',
			isMachineTranslated: true,
			originalLang: 'en'
		});
	});

	it('ignores empty translations when picking content', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '   '
		});
		const resolved = resolveLegalContent(content, 'en');
		expect(resolved?.html).toBe('<p>Hallo</p>');
		expect(resolved?.lang).toBe('de');
	});

	it('normalizes regional and informal UI languages', () => {
		const content = map({
			de: '<p>Hallo</p>',
			en: '<p>Hello</p>'
		});
		expect(resolveLegalContent(content, 'de@informal')?.html).toBe(
			'<p>Hallo</p>'
		);
		expect(resolveLegalContent(content, 'en-GB')?.html).toBe(
			'<p>Hello</p>'
		);
	});

	it('treats non-object JSON as plain content', () => {
		const resolved = resolveLegalContent('[1,2,3]', 'de');
		expect(resolved?.html).toBe('[1,2,3]');
	});
});

describe('pickConsentPrivacyContent', () => {
	const departmentContent = map({ de: '<p>Fachbereich</p>' });
	const tenantContent = '<p>Träger</p>';

	it('prefers the department dpp over the tenant content', () => {
		expect(
			pickConsentPrivacyContent(departmentContent, tenantContent)
		).toEqual({
			content: departmentContent,
			source: 'department'
		});
	});

	it('falls back to the tenant content when the department has none', () => {
		expect(pickConsentPrivacyContent(null, tenantContent)).toEqual({
			content: tenantContent,
			source: 'tenant'
		});
		expect(pickConsentPrivacyContent(undefined, tenantContent)).toEqual({
			content: tenantContent,
			source: 'tenant'
		});
	});

	it('treats a department map without renderable content as absent', () => {
		const emptyDepartment = map({
			de__meta: JSON.stringify({ mt: true, src: 'en' })
		});
		expect(
			pickConsentPrivacyContent(emptyDepartment, tenantContent)
		).toEqual({
			content: tenantContent,
			source: 'tenant'
		});
	});

	it('returns null when neither side has content', () => {
		expect(pickConsentPrivacyContent(null, '')).toEqual({
			content: null,
			source: null
		});
	});
});
