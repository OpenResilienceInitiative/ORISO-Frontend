// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiGetSessionRoomBySessionId,
	apiGetSessionRoomsByRoomIds
} from '../api/apiGetSessionRooms';
import { apiGetChatRoomById } from '../api/apiGetChatRoomById';
import { apiGetCaseHandoverCandidates } from '../api/apiCaseHandover';
import { buildExtendedSession } from '../globalState';
import { chatTransportService } from '../services/chatTransportService';
import { setMatrixClientServiceRef } from '../services/matrixClientRegistry';
import { useSession } from './useSession';
import { messageEventEmitter } from '../services/messageEventEmitter';
import { buildExtendedSession as realBuildExtendedSession } from '../globalState/helpers/stateHelpers';

vi.mock('../api', () => ({
	FETCH_ERRORS: { ABORT: 'ABORT', EMPTY: 'EMPTY', FORBIDDEN: 'FORBIDDEN' }
}));

vi.mock('../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: vi.fn(),
	apiGetSessionRoomsByRoomIds: vi.fn()
}));

vi.mock('../api/apiGetChatRoomById', () => ({
	apiGetChatRoomById: vi.fn()
}));

vi.mock('../api/apiCaseHandover', () => ({
	apiGetCaseHandoverCandidates: vi.fn()
}));

vi.mock('../globalState', () => ({
	buildExtendedSession: vi.fn()
}));

vi.mock('../services/chatTransportService', () => ({
	chatTransportService: {
		resolveSession: vi.fn(),
		markRoomAsRead: vi.fn()
	}
}));

describe('useSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each(['FORBIDDEN', 'EMPTY'])(
		'clears a typed group when the server returns %s without a fallback',
		async (error) => {
			const chat = { id: 41, conversationType: 'SELF_HELP' };
			const result = { sessions: [{ chat }] } as Awaited<
				ReturnType<typeof apiGetChatRoomById>
			>;
			const extended = { item: chat, isGroup: true } as ReturnType<
				typeof buildExtendedSession
			>;
			vi.mocked(apiGetChatRoomById)
				.mockResolvedValue(result)
				.mockResolvedValueOnce(result)
				.mockRejectedValueOnce(new Error(error));
			vi.mocked(buildExtendedSession).mockReturnValue(extended);
			const { result: loaded } = renderHook(() =>
				useSession(null, undefined, 41)
			);

			await waitFor(() => expect(loaded.current.session).toBe(extended));
			await act(async () => {
				await loaded.current.reload();
			});

			expect(apiGetChatRoomById).toHaveBeenCalledTimes(2);
			expect(apiGetSessionRoomBySessionId).not.toHaveBeenCalled();
			expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
			expect(loaded.current.session).toBeNull();
			expect(loaded.current.ready).toBe(true);
		}
	);

	it.each([{ session: { id: 41 } }, { chat: { id: 42 } }])(
		'rejects an exact group lookup response with the wrong identity: %o',
		async (row) => {
			vi.mocked(apiGetChatRoomById).mockResolvedValue({
				sessions: [row]
			} as Awaited<ReturnType<typeof apiGetChatRoomById>>);
			const { result } = renderHook(() =>
				useSession(null, undefined, 41)
			);

			await waitFor(() => expect(result.current.ready).toBe(true));
			expect(buildExtendedSession).not.toHaveBeenCalled();
			expect(apiGetSessionRoomBySessionId).not.toHaveBeenCalled();
			expect(result.current.session).toBeNull();
		}
	);

	it('loads a valid zero-valued session id', async () => {
		const rawSession = { session: { id: 0 } };
		const extendedSession = { item: { id: 0 } };
		vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() => useSession(null, 0));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledWith(
			0,
			expect.any(AbortSignal)
		);
		expect(result.current.session).toBe(extendedSession);
		expect(apiGetSessionRoomsByRoomIds).not.toHaveBeenCalled();
		expect(apiGetChatRoomById).not.toHaveBeenCalled();
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
	});

	describe('exact room-bound counselling action', () => {
		const roomId = '!old:matrix.example';
		const caseId = 42;
		const exact = {
			consultant: { id: 'different-assignee' },
			session: {
				id: caseId,
				matrixRoomId: roomId,
				registrationType: 'REGISTERED',
				conversationType: 'AGENCY_COUNSELLING'
			}
		};
		const expectNoFallback = () => {
			expect(apiGetSessionRoomBySessionId).not.toHaveBeenCalled();
			expect(apiGetChatRoomById).not.toHaveBeenCalled();
			expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
		};

		it('uses a single authorized room lookup and keeps the exact case after reassignment', async () => {
			vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
				sessions: [exact]
			} as any);
			vi.mocked(buildExtendedSession).mockReturnValue({
				item: exact.session
			} as any);
			const { result } = renderHook(() => useSession({ roomId, caseId }));
			await waitFor(() => expect(result.current.ready).toBe(true));
			expect(apiGetSessionRoomsByRoomIds).toHaveBeenCalledExactlyOnceWith(
				[roomId],
				expect.any(AbortSignal)
			);
			expect(result.current.session?.item).toBe(exact.session);
			expectNoFallback();
		});

		it('recognizes the deployed legacy registered, non-team session shape', async () => {
			const legacy = {
				...exact,
				session: {
					...exact.session,
					conversationType: null,
					isTeamSession: false,
					postcode: 10551
				}
			};
			vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
				sessions: [legacy]
			} as any);
			vi.mocked(buildExtendedSession).mockReturnValue({
				item: legacy.session
			} as any);
			const { result } = renderHook(() => useSession({ roomId, caseId }));
			await waitFor(() => expect(result.current.ready).toBe(true));
			expect(result.current.session?.item).toBe(legacy.session);
			expectNoFallback();
		});

		it.each([
			{ name: 'empty room response', sessions: [] },
			{
				name: 'group with the same case number',
				sessions: [{ chat: { id: caseId, matrixRoomId: roomId } }]
			},
			{
				name: 'wrong case',
				sessions: [{ session: { ...exact.session, id: 43 } }]
			},
			{
				name: 'wrong room',
				sessions: [
					{
						session: {
							...exact.session,
							matrixRoomId: '!other:matrix.example'
						}
					}
				]
			},
			{
				name: 'unknown modality',
				sessions: [
					{ session: { ...exact.session, conversationType: null } }
				]
			},
			{
				name: 'legacy team case',
				sessions: [
					{
						session: {
							...exact.session,
							conversationType: null,
							isTeamSession: true
						}
					}
				]
			},
			{
				name: 'legacy anonymous case',
				sessions: [
					{
						session: {
							...exact.session,
							conversationType: null,
							isTeamSession: false,
							registrationType: 'ANONYMOUS'
						}
					}
				]
			},
			{
				name: 'contradictory explicit agency and anonymous case',
				sessions: [
					{
						session: {
							...exact.session,
							registrationType: 'ANONYMOUS'
						}
					}
				]
			},
			{
				name: 'live chat',
				sessions: [
					{
						session: {
							...exact.session,
							conversationType: 'LIVE_CHAT'
						}
					}
				]
			},
			{ name: 'ambiguous rows', sessions: [exact, exact] }
		])(
			'rejects $name without numeric or handover fallback',
			async ({ sessions }) => {
				vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
					sessions
				} as any);
				const { result } = renderHook(() =>
					useSession({ roomId, caseId }, caseId)
				);
				await waitFor(() => expect(result.current.ready).toBe(true));
				expect(result.current.session).toBeNull();
				expect(buildExtendedSession).not.toHaveBeenCalled();
				expectNoFallback();
			}
		);

		it.each(['EMPTY', 'FORBIDDEN'])(
			'stops on room lookup %s',
			async (error) => {
				vi.mocked(apiGetSessionRoomsByRoomIds).mockRejectedValue(
					new Error(error)
				);
				const { result } = renderHook(() =>
					useSession({ roomId, caseId }, caseId)
				);
				await waitFor(() => expect(result.current.ready).toBe(true));
				expect(result.current.session).toBeNull();
				expectNoFallback();
			}
		);
	});

	it('loads a routed group chat by room id when both route params exist', async () => {
		const rawSession = {
			chat: { id: 1, matrixRoomId: '!room:matrix.localhost' }
		};
		const extendedSession = { item: rawSession.chat, isGroup: true };
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() =>
			useSession('!room:matrix.localhost', 1)
		);

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetSessionRoomsByRoomIds).toHaveBeenCalledWith(
			['!room:matrix.localhost'],
			expect.any(AbortSignal)
		);
		expect(apiGetSessionRoomBySessionId).not.toHaveBeenCalled();
		expect(result.current.session).toBe(extendedSession);
	});

	it.each([
		{ session: { id: 4711, status: 5 } },
		{ chat: { id: 4711, active: true } },
		{ session: { id: 4711, status: 5 }, chat: { id: 4711, active: true } },
		{ session: { id: 4712, status: 5 } },
		{ session: { id: 4711, status: 2 } },
		undefined
	])('accepts only the exact rejected 1:1 response: %j', async (entry) => {
		const extended = { item: { id: 4711, status: 5 } };
		vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
			sessions: entry ? [entry] : []
		} as never);
		vi.mocked(buildExtendedSession).mockReturnValue(extended as never);
		vi.mocked(apiGetCaseHandoverCandidates).mockResolvedValue({
			sessions: []
		});

		const { result } = renderHook(() =>
			useSession(null, 4711, undefined, false, true)
		);

		await waitFor(() => expect(result.current.ready).toBe(true));
		const exact =
			!entry?.chat &&
			entry?.session?.id === 4711 &&
			entry.session.status === 5;
		expect(result.current.session).toBe(exact ? extended : null);
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
		expect(apiGetChatRoomById).not.toHaveBeenCalled();
	});

	it('does not attempt another room lookup when rejected enquiry access fails', async () => {
		vi.mocked(apiGetSessionRoomBySessionId).mockRejectedValueOnce(
			new Error('FORBIDDEN')
		);
		const { result } = renderHook(() =>
			useSession(null, 4711, undefined, false, true)
		);

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(result.current.session).toBeNull();
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
		expect(apiGetChatRoomById).not.toHaveBeenCalled();
	});

	it('loads a valid zero-valued chat id', async () => {
		const rawSession = { chat: { id: 0 } };
		const extendedSession = { item: rawSession.chat, isGroup: true };
		vi.mocked(apiGetChatRoomById).mockResolvedValue({
			sessions: [rawSession]
		} as any);
		vi.mocked(buildExtendedSession).mockReturnValue(extendedSession as any);

		const { result } = renderHook(() => useSession(null, undefined, 0));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(apiGetChatRoomById).toHaveBeenCalledWith(
			0,
			expect.any(AbortSignal)
		);
		expect(result.current.session).toBe(extendedSession);
	});

	it('settles ready with no session when a fetch fails', async () => {
		vi.mocked(apiGetSessionRoomBySessionId).mockRejectedValue(
			new Error('network unavailable')
		);
		vi.mocked(apiGetCaseHandoverCandidates).mockRejectedValue(
			new Error('candidate lookup unavailable')
		);

		const { result } = renderHook(() => useSession(null, 7));

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(result.current.session).toBeNull();
	});

	it('aborts an in-flight request when route parameters change', async () => {
		const signals: AbortSignal[] = [];
		const secondRawSession = { session: { id: 2 } };
		const secondExtendedSession = { item: { id: 2 } };
		vi.mocked(apiGetSessionRoomBySessionId).mockImplementation(
			(sessionId, signal) => {
				signals.push(signal);
				return sessionId === 1
					? new Promise(() => undefined)
					: Promise.resolve({ sessions: [secondRawSession] } as any);
			}
		);
		vi.mocked(buildExtendedSession).mockReturnValue(
			secondExtendedSession as any
		);
		const { result, rerender } = renderHook(
			({ sessionId }) => useSession(null, sessionId),
			{ initialProps: { sessionId: 1 } }
		);

		rerender({ sessionId: 2 });

		await waitFor(() => expect(result.current.ready).toBe(true));
		expect(signals[0].aborted).toBe(true);
		expect(result.current.session).toBe(secondExtendedSession);
	});

	describe('read()', () => {
		// Unread axis (#1147): the backend hard-codes messagesRead: true, so
		// the receipt gate must derive read state from the Matrix client, not
		// from the DTO.
		afterEach(() => {
			setMatrixClientServiceRef(null);
		});

		const loadSessionWithRoom = async (unreadCount: number) => {
			const rawSession = { session: { id: 5 } };
			const extendedSession = {
				item: { id: 5, messagesRead: true }
			};
			vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
				sessions: [rawSession]
			} as any);
			vi.mocked(buildExtendedSession).mockReturnValue(
				extendedSession as any
			);
			vi.mocked(chatTransportService.resolveSession).mockReturnValue({
				matrixRoomId: '!room:hs'
			} as any);
			vi.mocked(chatTransportService.markRoomAsRead).mockResolvedValue(
				undefined
			);
			setMatrixClientServiceRef({
				getRoom: () => ({
					getUnreadNotificationCount: () => unreadCount
				})
			} as any);

			const { result } = renderHook(() => useSession(null, 5));
			await waitFor(() => expect(result.current.ready).toBe(true));
			return result;
		};

		it('publishes a Matrix read receipt for an unread room even though the DTO claims messagesRead', async () => {
			const result = await loadSessionWithRoom(2);

			result.current.read();

			expect(chatTransportService.markRoomAsRead).toHaveBeenCalledWith(
				'!room:hs'
			);
		});

		it('does not publish a receipt when the room has no unread messages', async () => {
			const result = await loadSessionWithRoom(0);

			result.current.read();

			expect(chatTransportService.markRoomAsRead).not.toHaveBeenCalled();
		});
	});
});

it('reloads an eligible accepted session by id when the room lookup has no content', async () => {
	const raw = { session: { id: 109, status: 2 } };
	const extended = { item: raw.session, isEnquiry: false };
	vi.mocked(apiGetSessionRoomsByRoomIds).mockRejectedValue(
		new Error('EMPTY')
	);
	vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
		sessions: [raw]
	} as any);
	vi.mocked(buildExtendedSession).mockReturnValue(extended as any);
	const { result } = renderHook(() => useSession('!room:test', 109));
	await waitFor(() => expect(result.current.ready).toBe(true));
	expect(result.current.session).toBe(extended);
});

describe('pending registered enquiry reconciliation', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.useFakeTimers();
		vi.mocked(buildExtendedSession).mockImplementation(
			realBuildExtendedSession
		);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});
	it('updates acceptance without reloading and stops polling the accepted conversation', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [
					{
						session: {
							id: 7,
							status: 1,
							modality: 'AGENCY_COUNSELLING'
						}
					}
				]
			} as any)
			.mockResolvedValue({
				sessions: [{ session: { id: 7, status: 2 } }]
			} as any);
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		expect(result.current.session.isEnquiry).toBe(true);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(result.current.session.isEnquiry).toBe(false);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(2);
	});
	it('keeps the current enquiry readable when a background request fails', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session: { id: 7, status: 1 } }]
			} as any)
			.mockRejectedValue(new Error('network unavailable'));
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		const displayed = result.current.session;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(result.current.session).toBe(displayed);
		expect(result.current.ready).toBe(true);
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
	});

	it('refreshes the owner without clearing the current session on a temporary failure', async () => {
		const session = { id: 7, status: 2 };
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session, consultant: { id: 'cover' } }]
			} as any)
			.mockRejectedValueOnce(new Error('network unavailable'))
			.mockResolvedValueOnce({
				sessions: [{ session, consultant: { id: 'owner' } }]
			} as any);

		const { result } = renderHook(() => useSession(null, 7));
		await act(async () => {});
		const displayed = result.current.session;
		expect(displayed.consultant.id).toBe('cover');

		await act(async () => result.current.refresh());
		expect(result.current.session).toBe(displayed);
		expect(result.current.ready).toBe(true);
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();

		await act(async () => result.current.refresh());
		expect(result.current.session.consultant.id).toBe('owner');
	});

	it('ignores a late response from the previously opened conversation', async () => {
		let finish!: (value: any) => void;
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					finish = resolve;
				})
			)
			.mockResolvedValue({
				sessions: [{ session: { id: 8, status: 1 } }]
			} as any);
		const { result, rerender } = renderHook(
			({ id }) => useSession(null, id, undefined, true),
			{ initialProps: { id: 7 } }
		);
		rerender({ id: 8 });
		await act(async () => {});
		await act(async () => {
			finish({ sessions: [{ session: { id: 7, status: 2 } }] });
		});
		expect(result.current.session.item.id).toBe(8);
		expect(result.current.session.isEnquiry).toBe(true);
	});

	it('coalesces focus and reconnect during a slow refresh and reconciles the latest state afterwards', async () => {
		let finish!: (value: any) => void;
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session: { id: 7, status: 1 } }]
			} as any)
			.mockReturnValueOnce(
				new Promise((resolve) => {
					finish = resolve;
				})
			)
			.mockResolvedValue({
				sessions: [{ session: { id: 7, status: 2 } }]
			} as any);
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		act(() => window.dispatchEvent(new Event('online')));
		const signal = vi.mocked(apiGetSessionRoomBySessionId).mock.calls[1][1];
		act(() => {
			window.dispatchEvent(new Event('focus'));
			window.dispatchEvent(new Event('online'));
		});
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(2);
		expect(signal.aborted).toBe(false);
		await act(async () => {
			finish({ sessions: [{ session: { id: 7, status: 1 } }] });
		});
		expect(result.current.session.isEnquiry).toBe(false);
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(3);
	});

	it('uses a matching Matrix signal to show acceptance before the next poll', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [
					{ session: { id: 7, status: 1, matrixRoomId: '!case:hs' } }
				]
			} as any)
			.mockResolvedValue({
				sessions: [
					{ session: { id: 7, status: 2, matrixRoomId: '!case:hs' } }
				]
			} as any);
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		await act(async () => {
			messageEventEmitter.emit({ roomId: '!other:hs' });
		});
		expect(result.current.session.isEnquiry).toBe(true);
		await act(async () => {
			messageEventEmitter.emit({ roomId: '!case:hs' });
		});
		expect(result.current.session.isEnquiry).toBe(false);
	});

	it('refreshes immediately on returning to a hidden tab without polling in the background', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session: { id: 7, status: 1 } }]
			} as any)
			.mockResolvedValue({
				sessions: [{ session: { id: 7, status: 2 } }]
			} as any);
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		const visibility = vi
			.spyOn(document, 'visibilityState', 'get')
			.mockReturnValue('hidden');
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});
		expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(1);
		visibility.mockReturnValue('visible');
		await act(async () => {
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(result.current.session.isEnquiry).toBe(false);
		visibility.mockRestore();
	});
	it.each([
		[false, 'AGENCY_COUNSELLING'],
		[true, 'LIVE_CHAT']
	])(
		'does not add polling outside registered asker enquiries (enabled=%s, modality=%s)',
		async (enabled, conversationType) => {
			vi.mocked(apiGetSessionRoomBySessionId).mockResolvedValue({
				sessions: [{ session: { id: 7, status: 1, conversationType } }]
			} as any);
			renderHook(() =>
				useSession(null, 7, undefined, enabled as boolean)
			);
			await act(async () => {});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(30000);
				window.dispatchEvent(new Event('online'));
			});
			expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(1);
		}
	);
	it('clears revoked session access instead of treating it as a temporary outage', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session: { id: 7, status: 1 } }]
			} as any)
			.mockRejectedValue(new Error('FORBIDDEN'));
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(result.current.session).toBeNull();
		expect(apiGetCaseHandoverCandidates).not.toHaveBeenCalled();
	});
	it('clears the current session after an explicit reload finds neither room nor fallback session', async () => {
		vi.mocked(apiGetSessionRoomsByRoomIds)
			.mockResolvedValueOnce({
				sessions: [
					{ session: { id: 7, status: 1, matrixRoomId: '!room:hs' } }
				]
			} as any)
			.mockRejectedValue(new Error('EMPTY'));
		vi.mocked(apiGetSessionRoomBySessionId).mockRejectedValue(
			new Error('EMPTY')
		);
		vi.mocked(apiGetCaseHandoverCandidates).mockResolvedValue({
			sessions: []
		} as any);
		const { result } = renderHook(() => useSession('!room:hs', 7));
		await act(async () => {});
		expect(result.current.session.item.id).toBe(7);
		await act(async () => {
			await Promise.resolve({ acknowledged: true }).then(
				result.current.reload
			);
		});
		expect(result.current.session).toBeNull();
		expect(result.current.ready).toBe(true);
	});
	it('hands the reload back, so a caller can wait until the session has been reloaded', async () => {
		let release: (value: unknown) => void = () => undefined;
		vi.mocked(apiGetSessionRoomsByRoomIds)
			.mockResolvedValueOnce({
				sessions: [
					{ session: { id: 7, status: 1, matrixRoomId: '!room:hs' } }
				]
			} as any)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = resolve;
					}) as never
			);
		const { result } = renderHook(() => useSession('!room:hs', 7));
		await act(async () => {});
		expect(result.current.session.item.id).toBe(7);

		let handed: unknown;
		await act(async () => {
			handed = result.current.reload();
		});
		expect(handed, 'the load itself, not nothing').toBeInstanceOf(Promise);
		let settled = false;
		void (handed as Promise<void>).then(() => {
			settled = true;
		});
		await act(async () => {});
		expect(settled, 'not before the sessions have come back').toBe(false);

		await act(async () => {
			release({
				sessions: [
					{ session: { id: 7, status: 2, matrixRoomId: '!room:hs' } }
				]
			});
			await handed;
		});
		expect(settled).toBe(true);
		expect(result.current.session.item.id).toBe(7);
	});
	it('reconciles a matching accepted-session feed signal without waiting for polling', async () => {
		vi.mocked(apiGetSessionRoomBySessionId)
			.mockResolvedValueOnce({
				sessions: [{ session: { id: 7, status: 1 } }]
			} as any)
			.mockResolvedValue({
				sessions: [{ session: { id: 7, status: 2 } }]
			} as any);
		const { result } = renderHook(() =>
			useSession(null, 7, undefined, true)
		);
		await act(async () => {});
		await act(async () => {
			messageEventEmitter.emit({
				changedSessionId: 8,
				source: 'notification-feed'
			});
		});
		expect(result.current.session.isEnquiry).toBe(true);
		await act(async () => {
			messageEventEmitter.emit({
				changedSessionId: 7,
				source: 'notification-feed'
			});
		});
		expect(result.current.session.isEnquiry).toBe(false);
	});
});
