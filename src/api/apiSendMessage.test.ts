import { describe, expect, it, vi } from 'vitest';
import { apiSendMessage } from './apiSendMessage';
import { getMatrixClientService } from '../services/matrixClientRegistry';

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

	it('falls back to the registered Matrix client service when no override is provided', async () => {
		const sendMessage = vi.fn(() =>
			Promise.resolve({ event_id: '$fallback-event' })
		);
		vi.mocked(getMatrixClientService).mockReturnValue({
			getClient: () => ({}),
			sendMessage
		} as any);

		const response = await apiSendMessage(
			'Hello from registry',
			'!fallback:example.org',
			true,
			false,
			103024,
			'!fallback:example.org',
			null,
			false,
			'Counselor'
		);

		expect(sendMessage).toHaveBeenCalledWith(
			'!fallback:example.org',
			'Hello from registry'
		);
		expect(response).toEqual({
			success: true,
			event_id: '$fallback-event'
		});
	});
});
