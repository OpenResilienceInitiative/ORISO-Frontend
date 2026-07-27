// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetLiveChatAvailability,
	apiHeartbeatLiveChatAvailability,
	apiSetLiveChatAvailability
} from './apiSetLiveChatAvailability';
import { fetchData, FETCH_METHODS, FETCH_SUCCESS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';

vi.mock('./fetchData', async () => {
	const actual: any = await vi.importActual('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('live-chat availability API', () => {
	it('reads the backend-authoritative state', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({ available: true });

		await expect(apiGetLiveChatAvailability()).resolves.toBe(true);
		expect(fetchData).toHaveBeenCalledWith({
			url: endpoints.consultantLiveChatAvailability,
			method: FETCH_METHODS.GET
		});
	});

	it('propagates rejected availability writes', async () => {
		vi.mocked(fetchData).mockRejectedValueOnce(
			new Error('redis unavailable')
		);

		await expect(apiSetLiveChatAvailability(true)).rejects.toThrow(
			'redis unavailable'
		);
	});

	it('uses the refresh-only heartbeat endpoint', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({ available: false });

		await expect(apiHeartbeatLiveChatAvailability()).resolves.toBe(false);
		expect(fetchData).toHaveBeenCalledWith({
			url: endpoints.consultantLiveChatAvailabilityHeartbeat,
			method: FETCH_METHODS.POST,
			responseHandling: [FETCH_SUCCESS.CONTENT]
		});
	});
});
