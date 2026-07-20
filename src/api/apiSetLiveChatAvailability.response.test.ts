// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiHeartbeatLiveChatAvailability } from './apiSetLiveChatAvailability';

describe('live-chat heartbeat response parsing', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('parses the authoritative availability from a real POST response', async () => {
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
		const response = {
			status: 200,
			json: vi.fn().mockResolvedValue({ available: true })
		} as unknown as Response;
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

		await expect(apiHeartbeatLiveChatAvailability()).resolves.toBe(true);
		expect(response.json).toHaveBeenCalledOnce();
	});
});
