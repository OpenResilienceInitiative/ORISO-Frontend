// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_METHODS: { GET: 'GET' },
	FETCH_ERRORS: { NO_MATCH: 'NO_MATCH', CATCH_ALL: 'CATCH_ALL' }
}));

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyDepartmentLegal: (agencyId: number, topicId: number) =>
			`https://api.test.local/service/agencies/${agencyId}/topics/${topicId}/legal`
	}
}));

/* eslint-disable-next-line import/first -- must load after the vi.mock above. */
import {
	apiGetConsentText,
	normalizeConsentTextResponse
} from './apiGetConsentText';
/* eslint-disable-next-line import/first */
import { clearDepartmentLegalCache } from './apiGetDepartmentLegal';
/* eslint-disable-next-line import/first */
import { fetchData, FETCH_ERRORS } from './fetchData';

beforeEach(() => clearDepartmentLegalCache());
afterEach(() => {
	clearDepartmentLegalCache();
	vi.clearAllMocks();
});

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

	it('drops a cookie notice the payload has no business carrying', () => {
		/* The schema says the cookie/authentication notice is the client's
		   fixed addendum, not part of the delivered text. Dropping it here, at
		   the boundary, is what makes it impossible further in: `ConsentTextData`
		   has no such field, so no component can read one by accident. If the
		   backend ever starts sending it, this is where the decision to ignore
		   it lives. */
		const normalized = normalizeConsentTextResponse({
			dpp: {
				consentText: 'Satz mit {{legal_links}}.',
				versionId: 3,
				cookieNotice: 'Wir nutzen gar keine Cookies.'
			}
		});

		expect(normalized).toEqual({
			sentence: 'Satz mit {{legal_links}}.',
			versionId: 3
		});
		expect(normalized).not.toHaveProperty('cookieNotice');
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

/**
 * The distinction this suite exists for: `ok` with no sentence and
 * `unavailable` mean opposite things for a Fachbereich the backend has already
 * said carries a published policy. Collapsing them — which is what the code did
 * before, mapping every rejection to `null` — let a dropped request enable
 * acceptance of the *platform* sentence for a department whose own wording is
 * the one in force. The user then agrees to a text that does not govern them:
 * the error path arriving at exactly the outcome the pending gate prevents.
 *
 * Tested here rather than through the components, because they mock this
 * module and so never execute the `catch` at all.
 */
describe('apiGetConsentText — a failed request is not an empty one', () => {
	it('reports unavailable when the request rejects', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('network down'));

		await expect(apiGetConsentText(42, 7)).resolves.toEqual({
			status: 'unavailable'
		});
	});

	it('reports ok with a null sentence when the backend simply has none', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			dpp: { content: '<p>Policy</p>', consentText: null },
			imprint: { content: null }
		});

		await expect(apiGetConsentText(42, 7)).resolves.toEqual({
			status: 'ok',
			consentText: null
		});
	});

	it('reports ok with the sentence when the backend has one', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			dpp: {
				consentText: 'Ich willige ein, siehe {{legal_links}}.',
				versionId: 5
			}
		});

		await expect(apiGetConsentText(42, 7)).resolves.toEqual({
			status: 'ok',
			consentText: {
				sentence: 'Ich willige ein, siehe {{legal_links}}.',
				versionId: 5
			}
		});
	});
});

describe('apiGetConsentText — an absent record is not an unreadable one', () => {
	/* Codex P1 on #1110: once the applicability predicate stopped gating the
	   request, a frontend paired with a backend that has no such endpoint would
	   404 on every selection. Mapping that to `unavailable` disables the consent
	   checkbox permanently and blocks registration outright. */
	it('reports ok with no consent text on 404', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.NO_MATCH)
		);

		await expect(apiGetConsentText(42, 7)).resolves.toEqual({
			status: 'ok',
			consentText: null
		});
	});

	it('still fails closed when the record may exist and could not be read', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.CATCH_ALL)
		);

		await expect(apiGetConsentText(42, 7)).resolves.toEqual({
			status: 'unavailable'
		});
	});
});
