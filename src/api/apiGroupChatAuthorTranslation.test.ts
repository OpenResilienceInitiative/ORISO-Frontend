import { describe, expect, it, vi } from 'vitest';
import { apiTranslateGroupChatAuthorContent } from './apiGroupChatAuthorTranslation';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { tenantServiceBase: 'https://tenant/service/tenant' }
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { POST: 'POST' },
	FETCH_SUCCESS: { CONTENT: 'CONTENT' },
	fetchData: vi.fn()
}));

describe('apiTranslateGroupChatAuthorContent', () => {
	it('uses the consultant-scoped translation endpoint', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			translations: { en: { welcome: 'Welcome' } }
		});

		await apiTranslateGroupChatAuthorContent({
			sourceLang: 'de',
			targetLangs: ['en'],
			texts: { welcome: 'Willkommen' }
		});

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://tenant/service/tenant/translate/group-chat-author-content',
			method: 'POST',
			bodyData: JSON.stringify({
				sourceLang: 'de',
				targetLangs: ['en'],
				texts: { welcome: 'Willkommen' }
			}),
			responseHandling: ['CONTENT']
		});
	});
});
