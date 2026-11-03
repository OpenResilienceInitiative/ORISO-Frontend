import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiGetAskerSessionList } from './apiGetAskerSessionList';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { askerSessions: '/service/users/sessions/askers' }
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { EMPTY: 'EMPTY', CATCH_ALL: 'CATCH_ALL' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

const deferred = () => {
	let resolve!: (value: unknown) => void;
	const promise = new Promise((r) => {
		resolve = r;
	});
	return { promise, resolve };
};

afterEach(() => {
	vi.mocked(fetchData).mockReset();
});

describe('apiGetAskerSessionList', () => {
	it('shares one request between callers that ask at the same time', async () => {
		const first = deferred();
		vi.mocked(fetchData).mockReturnValueOnce(first.promise as any);

		const a = apiGetAskerSessionList();
		const b = apiGetAskerSessionList();
		first.resolve({ sessions: [{ session: { id: 1 } }] });

		expect(await a).toEqual(await b);
		expect(fetchData).toHaveBeenCalledTimes(1);
	});

	/*
	 * OBP 2.1 #3 (CodeRabbit on #1991): a refresh signal that arrives while
	 * the first list request is still running must not get that request's
	 * answer — it was asked before the change the signal reports.
	 */
	it('fetches again after the running request when asked for a fresh list', async () => {
		const first = deferred();
		vi.mocked(fetchData)
			.mockReturnValueOnce(first.promise as any)
			.mockResolvedValueOnce({ sessions: [{ session: { id: 501 } }] });

		const initial = apiGetAskerSessionList();
		const refresh = apiGetAskerSessionList({ fresh: true });
		first.resolve({ sessions: [] });

		expect(await initial).toEqual({ sessions: [] });
		expect(await refresh).toEqual({ sessions: [{ session: { id: 501 } }] });
		expect(fetchData).toHaveBeenCalledTimes(2);
	});

	it('makes a single request for a fresh list when nothing is running', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({
			sessions: [{ session: { id: 7 } }]
		});

		expect(await apiGetAskerSessionList({ fresh: true })).toEqual({
			sessions: [{ session: { id: 7 } }]
		});
		expect(fetchData).toHaveBeenCalledTimes(1);
	});
});
