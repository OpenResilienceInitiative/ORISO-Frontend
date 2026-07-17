import { describe, expect, it } from 'vitest';
import { normalizePreferredLanguage } from './normalizePreferredLanguage';

describe('normalizePreferredLanguage', () => {
	it('strips regional locale suffixes for UserService LanguageCode', () => {
		expect(normalizePreferredLanguage('en-IN')).toBe('en');
		expect(normalizePreferredLanguage('en-GB')).toBe('en');
		expect(normalizePreferredLanguage('de-DE')).toBe('de');
	});

	it('returns fallback for empty values', () => {
		expect(normalizePreferredLanguage(undefined)).toBe('de');
		expect(normalizePreferredLanguage('')).toBe('de');
	});
});
