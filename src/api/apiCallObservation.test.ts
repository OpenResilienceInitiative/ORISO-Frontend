// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';

import { FETCH_ERRORS } from './fetchData';
import { endpoints } from '../resources/scripts/endpoints';
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
		expect(registered.url).toBe(endpoints.matrixCallObservations);
		expect(JSON.parse(registered.bodyData)).toEqual(call);
		expect(ended.url).toBe(`${endpoints.matrixCallObservations}/end`);
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
