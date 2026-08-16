// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchData, FETCH_METHODS } from './fetchData';
import { apiSetTeamAccess } from './apiSetTeamAccess';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

describe('apiSetTeamAccess', () => {
	beforeEach(() => vi.mocked(fetchData).mockReset());

	it('posts the positive allowed contract to the existing session endpoint', async () => {
		vi.mocked(fetchData).mockResolvedValue(undefined);
		await apiSetTeamAccess(42, false);

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(
					'/service/users/sessions/42/team-access$'
				),
				method: FETCH_METHODS.POST,
				bodyData: JSON.stringify({ allowed: false })
			})
		);
	});
});
