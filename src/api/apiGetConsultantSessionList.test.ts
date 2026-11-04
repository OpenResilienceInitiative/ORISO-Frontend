import { describe, expect, it, vi } from 'vite-plus/test';
import {
	apiGetConsultantEnquiryCount,
	apiGetConsultantSessionList,
	SESSION_COUNT,
	TIMEOUT
} from './apiGetConsultantSessionList';
import {
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../components/session/sessionHelpers';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		consultantEnquiriesBase:
			'https://api.oriso-dev.site/service/conversations/consultants/enquiries/',
		consultantSessions:
			'https://api.oriso-dev.site/service/users/sessions/consultants?status=2&',
		myMessagesBase:
			'https://api.oriso-dev.site/service/conversations/consultants/mymessages/'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_ERRORS: { EMPTY: 'EMPTY' },
	FETCH_METHODS: { GET: 'GET' },
	fetchData: vi.fn()
}));

describe('apiGetConsultantSessionList', () => {
	it('loads both registered and anonymous enquiries for the enquiry tab', async () => {
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) =>
			url.includes('/anonymous')
				? { sessions: [{ session: { id: 2 } }] }
				: { sessions: [{ session: { id: 1 } }] }) as any);

		const result = await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.ENQUIRY
		});

		const calledUrls = vi
			.mocked(fetchData)
			.mock.calls.map(([arg]: any) => arg.url);
		expect(calledUrls).toContain(
			`https://api.oriso-dev.site/service/conversations/consultants/enquiries/registered?count=${SESSION_COUNT}&filter=all&offset=0`
		);
		expect(calledUrls).toContain(
			`https://api.oriso-dev.site/service/conversations/consultants/enquiries/anonymous?count=${SESSION_COUNT}&filter=all&offset=0`
		);
		// Both feeds are merged so true-anonymous live-chat sessions appear alongside registered ones.
		expect(result.sessions.map((s: any) => s.session.id).sort()).toEqual([
			1, 2
		]);
	});

	it('dedupes sessions present in both enquiry feeds by session id', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			sessions: [{ session: { id: 7 } }]
		});

		const result = await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.ENQUIRY
		});

		expect(result.sessions.map((s: any) => s.session.id)).toEqual([7]);
	});

	it('keeps live-chat enquiries when the registered feed is empty (204/EMPTY)', async () => {
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/registered')) {
				throw new Error('EMPTY');
			}
			return {
				sessions: [{ session: { id: 42 } }],
				offset: 0,
				count: 1,
				total: 1
			};
		}) as any);

		const result = await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.ENQUIRY
		});

		// Regression: an empty registered feed must not discard the anonymous
		// live-chat queue ("Aktuell liegen keine Erstanfragen vor" bug).
		expect(result.sessions.map((s: any) => s.session.id)).toEqual([42]);
		expect(result.total).toBe(1);
	});

	it('keeps registered enquiries when the anonymous feed is empty (204/EMPTY)', async () => {
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/anonymous')) {
				throw new Error('EMPTY');
			}
			return { sessions: [{ session: { id: 7 } }], total: 1 };
		}) as any);

		const result = await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.ENQUIRY
		});

		expect(result.sessions.map((s: any) => s.session.id)).toEqual([7]);
	});

	it('rethrows EMPTY only when both enquiry feeds are empty', async () => {
		vi.mocked(fetchData).mockImplementation((async () => {
			throw new Error('EMPTY');
		}) as any);

		await expect(
			apiGetConsultantSessionList({ type: SESSION_LIST_TYPES.ENQUIRY })
		).rejects.toThrow('EMPTY');
	});

	it('propagates hard failures of the registered feed', async () => {
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/registered')) {
				throw new Error('Internal Server Error');
			}
			return { sessions: [{ session: { id: 2 } }] };
		}) as any);

		await expect(
			apiGetConsultantSessionList({ type: SESSION_LIST_TYPES.ENQUIRY })
		).rejects.toThrow('Internal Server Error');
	});

	it('loads consultant sessions with pagination', async () => {
		vi.mocked(fetchData).mockResolvedValue({ sessions: [] });

		await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.MY_SESSION,
			offset: 30,
			count: 10
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/sessions/consultants?status=2&count=10&filter=all&offset=30',
			method: 'GET',
			responseHandling: ['EMPTY'],
			timeout: TIMEOUT
		});
	});

	it('loads archived sessions without sending the filter query param', async () => {
		vi.mocked(fetchData).mockResolvedValue({ sessions: [] });

		await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.MY_SESSION,
			sessionListTab: SESSION_LIST_TAB_ARCHIVE,
			count: 5,
			offset: 10
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/conversations/consultants/mymessages/archive?count=5&offset=10',
			method: 'GET',
			responseHandling: ['EMPTY'],
			timeout: TIMEOUT
		});
	});
});

describe('apiGetConsultantEnquiryCount (FE#1435)', () => {
	const base =
		'https://api.oriso-dev.site/service/conversations/consultants/enquiries/';

	it('adds up the totals of both enquiry feeds, asking each for one row only', async () => {
		vi.mocked(fetchData).mockReset();
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) =>
			url.includes('/anonymous')
				? { sessions: [{}], total: 2, count: 1, offset: 0 }
				: { sessions: [{}], total: 3, count: 1, offset: 0 }) as any);

		await expect(apiGetConsultantEnquiryCount()).resolves.toBe(5);

		const urls = vi.mocked(fetchData).mock.calls.map(([a]: any) => a.url);
		expect(urls.sort()).toEqual([
			`${base}anonymous?count=1&filter=all&offset=0`,
			`${base}registered?count=1&filter=all&offset=0`
		]);
	});

	it('counts an empty feed (204) as zero', async () => {
		vi.mocked(fetchData).mockReset();
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/anonymous')) throw new Error('EMPTY');
			return { sessions: [{}], total: 4 };
		}) as any);
		await expect(apiGetConsultantEnquiryCount()).resolves.toBe(4);

		vi.mocked(fetchData).mockRejectedValue(new Error('EMPTY'));
		await expect(apiGetConsultantEnquiryCount()).resolves.toBe(0);
	});

	it('fails when the registered feed fails, so the last known count stays', async () => {
		vi.mocked(fetchData).mockReset();
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/registered')) throw new Error('500');
			return { sessions: [], total: 1 };
		}) as any);
		await expect(apiGetConsultantEnquiryCount()).rejects.toThrow('500');
	});

	it('treats a failing live-chat feed as zero, like the list does', async () => {
		vi.mocked(fetchData).mockReset();
		vi.mocked(fetchData).mockImplementation((async ({ url }: any) => {
			if (url.includes('/anonymous')) throw new Error('500');
			return { sessions: [{}], total: 2 };
		}) as any);
		await expect(apiGetConsultantEnquiryCount()).resolves.toBe(2);
	});
});
