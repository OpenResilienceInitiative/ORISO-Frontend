// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	apiCloseTeamDiscussion,
	apiGetTeamDiscussion,
	apiJoinTeamDiscussion,
	apiOpenTeamDiscussion
} from '../api/apiTeamDiscussion';
import { useTeamDiscussionChannel } from './useTeamDiscussionChannel';

vi.mock('../api/apiTeamDiscussion', () => ({
	apiGetTeamDiscussion: vi.fn(),
	apiOpenTeamDiscussion: vi.fn(),
	apiJoinTeamDiscussion: vi.fn(),
	apiCloseTeamDiscussion: vi.fn()
}));

describe('useTeamDiscussionChannel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue(null);
		vi.mocked(apiOpenTeamDiscussion).mockResolvedValue(null);
		vi.mocked(apiCloseTeamDiscussion).mockResolvedValue(undefined);
		vi.mocked(apiJoinTeamDiscussion).mockResolvedValue(null);
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
		// FE#2491: the route looks first, so it can never reopen a CLOSED one.
		expect(apiGetTeamDiscussion).toHaveBeenCalledWith(42);
		expect(apiOpenTeamDiscussion).toHaveBeenCalledWith(42);
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

	it('reads an ARCHIVED discussion through the read-only join after acceptance — no POST', async () => {
		vi.mocked(apiGetTeamDiscussion).mockResolvedValue({
			matrixRoomId: '!team:example.org',
			status: 'ARCHIVED'
		});
		vi.mocked(apiJoinTeamDiscussion).mockResolvedValue({
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
		expect(apiJoinTeamDiscussion).toHaveBeenCalledWith(42);
		expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
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
		await waitFor(() => expect(apiOpenTeamDiscussion).toHaveBeenCalled());
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
	describe('switch on and off (FE#2491)', () => {
		const CLOSED = {
			matrixRoomId: '!team:example.org',
			status: 'CLOSED' as const
		};

		it('a colleague who never joined reads a CLOSED discussion through the read-only join — no POST', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue(CLOSED);
			vi.mocked(apiJoinTeamDiscussion).mockResolvedValue(CLOSED);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: true
				})
			);

			await waitFor(() => expect(result.current.resolved).toBe(true));
			expect(apiGetTeamDiscussion).toHaveBeenCalledWith(42);
			expect(apiJoinTeamDiscussion).toHaveBeenCalledWith(42);
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
			expect(result.current.discussion?.status).toBe('CLOSED');
		});

		it('keeps a retry path while the read-only room is not confirmed yet (503)', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue(CLOSED);
			vi.mocked(apiJoinTeamDiscussion)
				.mockRejectedValueOnce(new Error('CATCH_ALL'))
				.mockResolvedValueOnce(CLOSED);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: true
				})
			);
			await waitFor(() =>
				expect(result.current.error?.message).toBe('CATCH_ALL')
			);
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();

			act(() => result.current.retry());
			await waitFor(() =>
				expect(result.current.discussion?.status).toBe('CLOSED')
			);
			expect(result.current.error).toBeNull();
			expect(apiJoinTeamDiscussion).toHaveBeenCalledTimes(2);
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('shows no old room once the case moved to another Beratungsstelle (join 204)', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue(CLOSED);
			vi.mocked(apiJoinTeamDiscussion).mockResolvedValue(null);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: false,
					teamChannelRequested: true
				})
			);
			await waitFor(() => expect(result.current.resolved).toBe(true));
			expect(result.current.discussion).toBeNull();
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('keeps OPEN when a lookup started before the switch-on answers late', async () => {
			let answerLookup!: (value: typeof CLOSED) => void;
			vi.mocked(apiGetTeamDiscussion).mockReturnValue(
				new Promise((resolve) => {
					answerLookup = resolve;
				})
			);
			vi.mocked(apiOpenTeamDiscussion).mockResolvedValue({
				...CLOSED,
				status: 'OPEN'
			});
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);
			await act(() => result.current.switchOn());
			expect(result.current.discussion?.status).toBe('OPEN');

			await act(async () => {
				answerLookup(CLOSED);
			});

			expect(result.current.discussion?.status).toBe('OPEN');
			expect(result.current.resolved).toBe(true);
		});

		it('reports a refused switch-on (400) as not allowed, not as a retry', async () => {
			vi.mocked(apiOpenTeamDiscussion).mockRejectedValue(
				new Error('BAD_REQUEST')
			);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);
			await waitFor(() => expect(result.current.resolved).toBe(true));

			await act(async () => {
				await result.current.switchOn().catch(() => undefined);
			});

			expect(result.current.toggleError).toBe('onNotAllowed');
			expect(result.current.discussion).toBeNull();
		});

		it('never POSTs for a CLOSED discussion while only viewing the enquiry', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue(CLOSED);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);

			await waitFor(() => expect(result.current.resolved).toBe(true));
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('switches a CLOSED discussion on with an explicit POST', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue(CLOSED);
			vi.mocked(apiOpenTeamDiscussion).mockResolvedValue({
				...CLOSED,
				status: 'OPEN'
			});
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);
			await waitFor(() => expect(result.current.resolved).toBe(true));

			await act(() => result.current.switchOn());

			expect(apiOpenTeamDiscussion).toHaveBeenCalledTimes(1);
			expect(apiOpenTeamDiscussion).toHaveBeenCalledWith(42);
			expect(result.current.discussion?.status).toBe('OPEN');
			expect(result.current.toggleError).toBeNull();
		});

		it('never switches on after accept — the archive is not reopened', async () => {
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: false,
					teamChannelRequested: false
				})
			);
			await waitFor(() => expect(result.current.resolved).toBe(true));

			await act(() => result.current.switchOn());

			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('switches an OPEN discussion off with DELETE and keeps its history as CLOSED', async () => {
			vi.mocked(apiGetTeamDiscussion)
				.mockResolvedValueOnce({ ...CLOSED, status: 'OPEN' })
				.mockResolvedValue(CLOSED);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);
			await waitFor(() =>
				expect(result.current.discussion?.status).toBe('OPEN')
			);

			await act(() => result.current.switchOff());

			expect(apiCloseTeamDiscussion).toHaveBeenCalledWith(42);
			await waitFor(() =>
				expect(result.current.discussion).toMatchObject({
					matrixRoomId: '!team:example.org',
					status: 'CLOSED'
				})
			);
			// The lookup runs again after the DELETE, so a stale OPEN answer
			// cannot win; it never POSTs.
			expect(apiGetTeamDiscussion).toHaveBeenCalledTimes(2);
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('never POSTs after a failed lookup — the room might be CLOSED', async () => {
			vi.mocked(apiGetTeamDiscussion).mockRejectedValue(
				new Error('offline')
			);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: true
				})
			);
			await waitFor(() =>
				expect(result.current.error?.message).toBe('offline')
			);
			expect(apiOpenTeamDiscussion).not.toHaveBeenCalled();
		});

		it('reports a failed switch and keeps the discussion OPEN', async () => {
			vi.mocked(apiGetTeamDiscussion).mockResolvedValue({
				...CLOSED,
				status: 'OPEN'
			});
			vi.mocked(apiCloseTeamDiscussion).mockRejectedValue(
				new Error('FORBIDDEN')
			);
			const { result } = renderHook(() =>
				useTeamDiscussionChannel({
					sessionId: 42,
					enabled: true,
					allowCreate: true,
					teamChannelRequested: false
				})
			);
			await waitFor(() =>
				expect(result.current.discussion?.status).toBe('OPEN')
			);

			await act(async () => {
				await result.current.switchOff().catch(() => undefined);
			});

			expect(result.current.toggleError).toBe('off');
			expect(result.current.discussion?.status).toBe('OPEN');
		});
	});
});
