import { describe, expect, it, vi } from 'vitest';
import {
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
	it('loads registered enquiries for the enquiry tab', async () => {
		vi.mocked(fetchData).mockResolvedValue({ sessions: [] });

		await apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.ENQUIRY
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: `https://api.oriso-dev.site/service/conversations/consultants/enquiries/registered?count=${SESSION_COUNT}&filter=all&offset=0`,
			method: 'GET',
			rcValidation: true,
			responseHandling: ['EMPTY'],
			timeout: TIMEOUT
		});
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
			rcValidation: true,
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
			rcValidation: true,
			responseHandling: ['EMPTY'],
			timeout: TIMEOUT
		});
	});
});
