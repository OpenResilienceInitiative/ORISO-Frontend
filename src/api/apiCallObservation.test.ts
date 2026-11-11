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
	it('sends both calls as POST to the observation endpoint without EMPTY handling', async () => {
		const call = {
			sourceRoomId: '!s',
			callId: 'c',
			callRoomId: '!m',
			video: true
		};
		await apiRegisterCallObservation(call);
		await apiEndCallObservation({ sourceRoomId: '!s', callId: 'c' });
		expect(fetchData).toHaveBeenCalledTimes(2);
		const [[registered], [ended]] = fetchData.mock.calls as any[];
		// Literal paths: a change to the endpoint table must fail here too.
		expect(
			registered.url.endsWith('/service/matrix/calls/observations')
		).toBe(true);
		expect(JSON.parse(registered.bodyData)).toEqual(call);
		expect(
			ended.url.endsWith('/service/matrix/calls/observations/end')
		).toBe(true);
		expect(JSON.parse(ended.bodyData)).toEqual({
			sourceRoomId: '!s',
			callId: 'c'
		});
		for (const options of [registered, ended]) {
			expect(options.responseHandling).not.toContain(FETCH_ERRORS.EMPTY);
			expect(options.method).toBe('POST');
		}
	});
});
