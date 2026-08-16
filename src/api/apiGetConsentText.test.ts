// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { normalizeConsentTextResponse } from './apiGetConsentText';

/**
 * The wire shape is not final — the AgencyService half of EPIC #250 is being
 * built in parallel. These tests pin the *frontend's* half of the bargain:
 * whatever the field ends up being called, a response that does not carry a
 * consent sentence must produce `null`, because `null` is what makes the
 * registration render exactly today's static sentence.
 */
describe('normalizeConsentTextResponse', () => {
	it('reads the sentence from the dpp, where ADR-021 decision 4 puts it', () => {
		expect(
			normalizeConsentTextResponse({
				dpp: {
					content: '<p>Datenschutzerklärung</p>',
					consentText:
						'Ich habe die {{legal_links}} der Beratungsstelle Musterstadt gelesen.',
					versionId: 'v-7'
				},
				imprint: { content: null }
			})
		).toEqual({
			sentence:
				'Ich habe die {{legal_links}} der Beratungsstelle Musterstadt gelesen.',
			versionId: 'v-7'
		});
	});

	it('carries a null version on backends without the version history', () => {
		expect(
			normalizeConsentTextResponse({
				dpp: { consentText: 'Ich habe die {{legal_links}} gelesen.' }
			})
		).toEqual({
			sentence: 'Ich habe die {{legal_links}} gelesen.',
			versionId: null
		});
	});

	it('returns null when the department carries no consent sentence', () => {
		expect(
			normalizeConsentTextResponse({
				dpp: { content: '<p>Nur die Policy</p>' },
				imprint: { content: null }
			})
		).toBeNull();
	});

	it('treats a blank sentence as not configured', () => {
		expect(
			normalizeConsentTextResponse({ dpp: { consentText: '   ' } })
		).toBeNull();
	});

	it('survives a response that is not an object at all', () => {
		expect(normalizeConsentTextResponse(null)).toBeNull();
		expect(normalizeConsentTextResponse(undefined)).toBeNull();
		expect(
			normalizeConsentTextResponse('<html>error page</html>')
		).toBeNull();
	});
});
