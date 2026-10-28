// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { useCaseHandoverStatusRefresh } from './useCaseHandoverStatusRefresh';

const api = vi.hoisted(() => ({
	apiGetCaseHandoverStatus: vi.fn(async (sessionId: number) => ({
		sessionId
	}))
}));

vi.mock('../../api', () => api);

afterEach(() => vi.clearAllMocks());

const refresh = (notifications: any[]) => {
	const onStatus = vi.fn();
	renderHook(() =>
		useCaseHandoverStatusRefresh({
			enabled: true,
			sessionId: 13,
			notifications,
			onStatus
		})
	);
	return onStatus;
};

describe('useCaseHandoverStatusRefresh (#1888: reads the activity event model)', () => {
	it('re-reads the status after a resolution event for this session', async () => {
		const onStatus = refresh([
			{
				id: 'e1',
				eventType: 'case.handover.granted',
				sourceSessionId: '13'
			}
		]);
		await waitFor(() => expect(onStatus).toHaveBeenCalled());
		expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
	});

	it('finds the session in params as well', async () => {
		const onStatus = refresh([
			{
				id: 'e1',
				eventType: 'case.handover.consent.declined',
				params: { sourceSessionId: 13 }
			}
		]);
		await waitFor(() => expect(onStatus).toHaveBeenCalled());
	});

	it('ignores other sessions', () => {
		refresh([
			{
				id: 'e1',
				eventType: 'case.handover.granted',
				sourceSessionId: '14'
			}
		]);
		expect(api.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
	});
});
