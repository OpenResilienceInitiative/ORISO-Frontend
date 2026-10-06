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

		expect(result.current).toMatchObject({
			discussion: null,
			error: null,
			resolved: true
		});
		expect(apiGetTeamDiscussion).not.toHaveBeenCalled();
		expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
	});

	it('joins an existing discussion without creating one after enquiry acceptance', async () => {
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue({
			matrixRoomId: '!team:example.org',
			status: 'ARCHIVED'
		});
		vi.mocked(apiOpenTeamDiscussion).mockResolvedValue({
			matrixRoomId: '!team:example.org',
			status: 'ARCHIVED'
		});
		const { result } = renderHook(() =>
			useTeamDiscussionChannel({
				sessionId: 42,
				enabled: true,
				allowCreate: false,
				teamChannelRequested: true
			})
		);

		await waitFor(() => expect(result.current.resolved).toBe(true));
		expect(apiGetTeamDiscussion).toHaveBeenCalledWith(42);
		expect(apiOpenTeamDiscussion).toHaveBeenCalledWith(42);
		expect(result.current.discussion?.status).toBe('ARCHIVED');
	});

	it('does not create a discussion after acceptance when none exists', async () => {
		const { result } = renderHook(() =>
			useTeamDiscussionChannel({
				sessionId: 42,
				enabled: true,
				allowCreate: false,
				teamChannelRequested: true
			})
		);

		await waitFor(() => expect(result.current.resolved).toBe(true));
		expect(apiGetTeamDiscussion).toHaveBeenCalledWith(42);
		expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		expect(result.current.discussion).toBeNull();
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

	it('becomes unresolved synchronously when the same session opens the team route', async () => {
		let resolveOpen: (value: null) => void = () => undefined;
		vi.mocked(apiOpenTeamDiscussion).mockImplementation(
			() => new Promise((resolve) => (resolveOpen = resolve))
		);
		const { result, rerender } = renderHook(
			({ requested }) =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: requested
				}),
			{ initialProps: { requested: false } }
		);
		await waitFor(() => expect(result.current.resolved).toBe(true));

		rerender({ requested: true });
		expect(result.current).toMatchObject({
			discussion: null,
			error: null,
			resolved: false
		});
		resolveOpen(null);
		await waitFor(() => expect(result.current.resolved).toBe(true));
	});

	it('keeps request failures distinct and retries them', async () => {
		vi.mocked(apiGetTeamDiscussion)
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce({
				matrixRoomId: '!team:example.org',
				status: 'OPEN'
			});
		const { result } = renderHook(() =>
			useTeamDiscussionChannel({
				sessionId: 42,
				enabled: true,
				allowCreate: false,
				teamChannelRequested: false
			})
		);

		await waitFor(() =>
			expect(result.current.error?.message).toBe('offline')
		);
		result.current.retry();
		await waitFor(() =>
			expect(result.current.discussion?.matrixRoomId).toBe(
				'!team:example.org'
			)
		);
		expect(result.current.error).toBeNull();
	});
});
