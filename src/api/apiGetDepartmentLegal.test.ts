import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetDepartmentLegal,
	normalizeDepartmentLegalResponse
} from './apiGetDepartmentLegal';
import { fetchData, FETCH_ERRORS } from './fetchData';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return {
		...actual,
		fetchData: vi.fn()
	};
});

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyDepartmentLegal: (agencyId: number, topicId: number) =>
			`https://api.test.local/service/agencies/${agencyId}/topics/${topicId}/legal`
	}
}));

describe('normalizeDepartmentLegalResponse', () => {
	it('maps consentText from the dpp payload', () => {
		expect(
			normalizeDepartmentLegalResponse({
				dpp: {
					content: '{"de":"<p>DPP</p>"}',
					consentText: '{"de":"Ich willige ein."}'
				},
				imprint: { content: null }
			})
		).toEqual({
			dpp: {
				content: '{"de":"<p>DPP</p>"}',
				consentText: '{"de":"Ich willige ein."}'
			},
			imprint: { content: null, consentText: null }
		});
	});

	it('normalizes a missing consentText to null', () => {
		expect(
			normalizeDepartmentLegalResponse({
				dpp: { content: '<p>DPP</p>' },
				imprint: { content: null }
			})
		).toEqual({
			dpp: { content: '<p>DPP</p>', consentText: null },
			imprint: { content: null, consentText: null }
		});
	});
});

describe('apiGetDepartmentLegal', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('resolves the published legal texts including consentText', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			dpp: {
				content: '{"de":"<p>Hallo</p>"}',
				consentText: '{"de":"Einwilligungssatz"}'
			},
			imprint: { content: null }
		});

		await expect(apiGetDepartmentLegal(42, 7)).resolves.toEqual({
			dpp: {
				content: '{"de":"<p>Hallo</p>"}',
				consentText: '{"de":"Einwilligungssatz"}'
			},
			imprint: { content: null, consentText: null }
		});
	});

	it('degrades gracefully to null when the endpoint 404s (backend without AgencyService #90)', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.NO_MATCH)
		);

		await expect(apiGetDepartmentLegal(42, 7)).resolves.toBeNull();
	});

	it('degrades gracefully to null on any other error', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			new Error(FETCH_ERRORS.CATCH_ALL)
		);

		await expect(apiGetDepartmentLegal(42, 7)).resolves.toBeNull();
	});

	it('opts into non-redirecting error handling for 404s', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			dpp: { content: null },
			imprint: { content: null }
		});

		await apiGetDepartmentLegal(42, 7);

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.test.local/service/agencies/42/topics/7/legal',
				skipAuth: true,
				responseHandling: expect.arrayContaining([
					FETCH_ERRORS.NO_MATCH,
					FETCH_ERRORS.CATCH_ALL
				])
			})
		);
	});
});
