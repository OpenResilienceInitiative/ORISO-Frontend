// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { normalizeConsentTextResponse } from './apiGetConsentText';

/**
 * Pinned against the response ORISO-AgencyService#256 actually serves:
 *
 *   { "dpp":     { "content", "consentText", "sourceLevel", "versionId" },
 *     "imprint": { ... } }
 *
 * and against the frontend's half of the bargain: a response carrying no
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
					sourceLevel: 'DEPARTMENT',
					versionId: 7
				},
				imprint: {
					content: '<p>Impressum</p>',
					consentText: null,
					sourceLevel: 'AGENCY',
					versionId: 3
				}
			})
		).toEqual({
			sentence:
				'Ich habe die {{legal_links}} der Beratungsstelle Musterstadt gelesen.',
			versionId: 7
		});
	});

	it('keeps the numeric version id the schema declares as int64', () => {
		/* `versionId` is `integer`/`int64` on the wire. Reading it as a string
		   yielded null for every response, which would have made every consent
		   binding version-blind — a Träger publishing new wording would not
		   have invalidated an existing acceptance. */
		expect(
			normalizeConsentTextResponse({
				dpp: { consentText: 'Satz mit {{legal_links}}.', versionId: 42 }
			})?.versionId
		).toBe(42);
	});

	it('ignores a consent sentence sitting on the imprint', () => {
		// The imprint is an information duty and never a consent gate
		// (ADR-021 decision 7); the schema says consentText is always null there.
		expect(
			normalizeConsentTextResponse({
				dpp: { content: '<p>Policy</p>', consentText: null },
				imprint: { consentText: 'Ich willige ein {{legal_links}}.' }
			})
		).toBeNull();
	});

	it('carries a null version for the levels whose history lives elsewhere', () => {
		// Träger and platform levels: their history is ORISO-TenantService's.
		expect(
			normalizeConsentTextResponse({
				dpp: {
					consentText: 'Ich habe die {{legal_links}} gelesen.',
					sourceLevel: 'TENANT',
					versionId: null
				}
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
