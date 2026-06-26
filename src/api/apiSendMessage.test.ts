import { describe, expect, it, vi } from 'vitest';
import { apiSendMessage } from './apiSendMessage';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		sendMessage: '/service/messages',
		eventNotifications: '/service/notifications'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: { POST: 'POST' },
	fetchData: vi.fn()
}));

vi.mock('../services/matrixClientRegistry', () => ({
	getMatrixClientService: vi.fn(() => null)
}));

vi.mock('./apiPostMessageEventNotification', () => ({
	apiPostMessageEventNotification: vi.fn(() => Promise.resolve({}))
}));

describe('apiSendMessage', () => {
	it('uses the provided Matrix client service for Matrix-backed sessions', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$event' })
		);
		const matrixClientService = {
			getClient: () => ({}),
			sendMessage
		};

		const response = await apiSendMessage(
			'Hello Matrix',
			'!room:example.org',
			true,
			false,
			103024,
			'!room:example.org',
			null,
			false,
			'Counselor',
			matrixClientService as any
		);

		expect(sendMessage).toHaveBeenCalledWith(
			'!room:example.org',
			'Hello Matrix'
		);
		expect(response).toEqual({ success: true, event_id: '$event' });
	});
});
