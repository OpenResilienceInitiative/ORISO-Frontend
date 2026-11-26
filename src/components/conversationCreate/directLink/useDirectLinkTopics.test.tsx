// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { UserDataContext } from '../../../globalState';
import * as topicsApi from '../../../api/apiGetTenantAgenciesTopics';
import { useDirectLinkTopics } from './useDirectLinkTopics';

vi.mock('../../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi.fn(() =>
		Promise.resolve([{ id: 7, name: 'Sucht' }])
	)
}));
const api = vi.mocked(topicsApi);

const withUser =
	(userData: Record<string, unknown>) =>
	({ children }: { children: React.ReactNode }) => (
		<UserDataContext.Provider value={{ userData } as never}>
			{children}
		</UserDataContext.Provider>
	);

beforeEach(() => vi.clearAllMocks());

/* #2523: an advice seeker's `agencies` is null, not undefined. */
describe('useDirectLinkTopics (#2523)', () => {
	it('survives agencies null for an advice seeker and loads nothing', async () => {
		const { result } = renderHook(() => useDirectLinkTopics(false), {
			wrapper: withUser({ agencies: null })
		});
		expect(result.current.agencies).toEqual([]);
		expect(result.current.topics).toEqual([]);
		await act(() => result.current.load());
		expect(api.apiGetTenantAgenciesTopics).not.toHaveBeenCalled();
	});

	it('survives agencies null even when enabled', () => {
		const { result } = renderHook(() => useDirectLinkTopics(true), {
			wrapper: withUser({ agencies: null })
		});
		expect(result.current.agencies).toEqual([]);
	});

	it("loads a counsellor's topics", async () => {
		const { result } = renderHook(() => useDirectLinkTopics(true), {
			wrapper: withUser({
				agencies: [{ id: 1, topicIds: [7] }]
			})
		});
		await act(() => result.current.load());
		expect(result.current.topics).toEqual([{ value: '7', label: 'Sucht' }]);
		expect(result.current.agencies).toEqual([{ id: 1, topicIds: [7] }]);
	});
});
