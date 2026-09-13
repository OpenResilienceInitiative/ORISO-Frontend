// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetTeamDiscussion,
	apiOpenTeamDiscussion
} from '../api/apiTeamDiscussion';
import { useTeamDiscussionChannel } from './useTeamDiscussionChannel';

vi.mock('../api/apiTeamDiscussion', () => ({
	apiGetTeamDiscussion: vi.fn(),
	apiOpenTeamDiscussion: vi.fn()
}));

describe('useTeamDiscussionChannel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue(null);
		vi.mocked(apiOpenTeamDiscussion).mockResolvedValue(null);
	});

	it('opens and joins an eligible discussion when the team route is requested', async () => {
		vi.mocked(apiOpenTeamDiscussion).mockResolvedValue({
			matrixRoomId: '!team:example.org',
			status: 'OPEN'
		});
		const { result } = renderHook(() =>
			useTeamDiscussionChannel({
				sessionId: 42,
				enabled: true,
				allowCreate: true,
				teamChannelRequested: true
			})
		);

		await waitFor(() => expect(result.current.resolved).toBe(true));
		expect(apiOpenTeamDiscussion).toHaveBeenCalledWith(42);
		expect(apiGetTeamDiscussion).not.toHaveBeenCalled();
		expect(result.current.discussion?.matrixRoomId).toBe(
			'!team:example.org'
		);
	});

	it('settles disabled channels immediately so stale routes can be rejected', () => {
		const { result } = renderHook(() =>
			useTeamDiscussionChannel({
				sessionId: 42,
				enabled: false,
				allowCreate: false,
				teamChannelRequested: true
			})
		);

		expect(result.current).toEqual({ discussion: null, resolved: true });
		expect(apiGetTeamDiscussion).not.toHaveBeenCalled();
		expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
	});

	it('never exposes the previous session room while the next lookup is pending', async () => {
		let resolveSecond: (value: null) => void = () => undefined;
		vi.mocked(apiGetTeamDiscussion)
			.mockResolvedValueOnce({
				matrixRoomId: '!old-team:example.org',
				status: 'OPEN'
			})
			.mockImplementationOnce(
				() => new Promise((resolve) => (resolveSecond = resolve))
			);
		const { result, rerender } = renderHook(
			({ sessionId }) =>
				useTeamDiscussionChannel({
					sessionId,
					enabled: true,
					allowCreate: false,
					teamChannelRequested: false
				}),
			{ initialProps: { sessionId: 1 } }
		);
		await waitFor(() => expect(result.current.resolved).toBe(true));

		rerender({ sessionId: 2 });
		expect(result.current.discussion).toBeNull();
		expect(result.current.resolved).toBe(false);
		resolveSecond(null);
		await waitFor(() => expect(result.current.resolved).toBe(true));
	});
});
