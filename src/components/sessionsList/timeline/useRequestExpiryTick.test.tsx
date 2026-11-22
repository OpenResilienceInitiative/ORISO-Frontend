// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vite-plus/test';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';
import { useRequestExpiryTick } from './useRequestExpiryTick';

it('caps the expiry timer for a request weeks away and rearms only at the cap', () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
	const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
	const maximumDelay = 2_147_483_647;
	const delayUntilStart = 30 * 24 * 60 * 60 * 1000;
	const start = Date.now() + delayUntilStart;
	const appointments: SessionAppointment[] = [
		{
			id: 'r1',
			sessionId: 4401,
			startTime: new Date(start).toISOString(),
			endTime: new Date(start + 3_600_000).toISOString(),
			status: 'REQUESTED'
		}
	];
	const longDelays = () =>
		setTimeoutSpy.mock.calls
			.map(([, delay]) => delay ?? 0)
			.filter((delay) => delay >= 24 * 60 * 60 * 1_000);

	try {
		renderHook(() => useRequestExpiryTick(appointments));
		expect(longDelays()).toEqual([maximumDelay]);

		act(() => vi.advanceTimersByTime(maximumDelay - 1));
		expect(longDelays()).toEqual([maximumDelay]);

		act(() => vi.advanceTimersByTime(1));
		expect(longDelays()).toEqual([
			maximumDelay,
			delayUntilStart - maximumDelay + 1
		]);
	} finally {
		cleanup();
		setTimeoutSpy.mockRestore();
		vi.useRealTimers();
	}
});
