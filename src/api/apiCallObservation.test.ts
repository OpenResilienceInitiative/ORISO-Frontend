// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';

import { FETCH_ERRORS } from './fetchData';
import {
	apiEndCallObservation,
	apiRegisterCallObservation
} from './apiCallObservation';

const fetchData = vi.fn(async () => ({}));
vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData: (...args: unknown[]) => (fetchData as any)(...args)
}));

describe('call observation api', () => {
	it('does not treat a 204 as an error', async () => {
		await apiRegisterCallObservation({
			sourceRoomId: '!s',
			callId: 'c',
			callRoomId: '!m',
			video: true
		});
		await apiEndCallObservation({ sourceRoomId: '!s', callId: 'c' });
		for (const [options] of fetchData.mock.calls as any[]) {
			expect(options.responseHandling).not.toContain(FETCH_ERRORS.EMPTY);
			expect(options.method).toBe('POST');
		}
		expect(fetchData).toHaveBeenCalledTimes(2);
	});
});
