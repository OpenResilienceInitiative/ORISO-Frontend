// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { apiGetUserDataBySessionId } from '../api/apiGetUserDataBySessionId';
import { useCaseAskerId } from './useCaseAskerId';

vi.mock('../api/apiGetUserDataBySessionId', () => ({
	apiGetUserDataBySessionId: vi.fn()
}));

describe('useCaseAskerId', () => {
	it('never returns the client of the previous session', async () => {
		let answerSecond: (value: never) => void = () => {};
		vi.mocked(apiGetUserDataBySessionId)
			.mockResolvedValueOnce({ askerId: 'asker-1' } as never)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					answerSecond = resolve;
				})
			);
		const { result, rerender } = renderHook(
			({ sessionId }) => useCaseAskerId(sessionId),
			{ initialProps: { sessionId: 1 } }
		);
		await waitFor(() => expect(result.current.askerId).toBe('asker-1'));

		rerender({ sessionId: 2 });
		expect(result.current).toEqual({ settled: false, askerId: undefined });

		await act(async () => answerSecond({ askerId: 'asker-2' } as never));
		expect(result.current).toEqual({ settled: true, askerId: 'asker-2' });
	});

	it('settles without a client when the lookup fails', async () => {
		vi.mocked(apiGetUserDataBySessionId).mockRejectedValueOnce(
			new Error('403')
		);
		const { result } = renderHook(() => useCaseAskerId(3));
		await waitFor(() => expect(result.current.settled).toBe(true));
		expect(result.current.askerId).toBeUndefined();
	});
});
