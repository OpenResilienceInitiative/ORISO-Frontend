import { describe, expect, it, vi } from 'vitest';
import { fetchData } from './fetchData';
import {
	apiChangeGroupChatParticipantRole,
	apiRemoveGroupChatParticipant,
	apiTransferGroupChatOwnership
} from './apiGroupChatRoles';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		chatSeriesBase: 'https://api.example/service/users/chat-series/'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { DELETE: 'DELETE', POST: 'POST', PUT: 'PUT' },
	fetchData: vi.fn(() => Promise.resolve())
}));

describe('group-chat role API helpers', () => {
	it('changes a participant role through the stable Series identity', async () => {
		await apiChangeGroupChatParticipantRole(
			42,
			'consultant-7',
			'CO_MODERATOR'
		);

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example/service/users/chat-series/42/participants/consultant-7/role',
			method: 'PUT',
			bodyData: JSON.stringify({ role: 'CO_MODERATOR' })
		});
	});

	it('transfers primary ownership without display-name routing', async () => {
		await apiTransferGroupChatOwnership(42, 'consultant-9');

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example/service/users/chat-series/42/transfer-ownership',
			method: 'POST',
			bodyData: JSON.stringify({ consultantId: 'consultant-9' })
		});
	});

	it('removes a participant through the stable Series identity', async () => {
		await apiRemoveGroupChatParticipant(42, 'consultant-9');

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.example/service/users/chat-series/42/participants/consultant-9',
			method: 'DELETE'
		});
	});
});
