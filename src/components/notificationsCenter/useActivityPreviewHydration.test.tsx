// @vitest-environment oriso-jsdom — the gate reaches the api layer, which reads
// `window` while resolving the API base URL at import time.
import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionsDataContext, UserDataContext } from '../../globalState';
import { resetCaseHandoverPreviewGateCache } from './caseHandoverPreviewGate';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { useActivityPreviewHydration } from './useActivityPreviewHydration';

const api = vi.hoisted(() => ({
	apiGetCaseHandoverStatus: vi.fn(async () => ({ canViewContent: true })),
	apiGetSessionSupervisors: vi.fn(async () => [{ matrixRoomId: '!side:x' }]),
	apiGetTeamDiscussion: vi.fn(async () => ({
		matrixRoomId: '!team:x',
		status: 'OPEN'
	})),
	apiGetGroupChatInfo: vi.fn(async () => ({
		id: 77,
		active: true,
		matrixRoomId: '!g:x',
		bannedUsers: []
	}))
}));
vi.mock('../../api/apiCaseHandover', () => api);
vi.mock('../../api/apiGetGroupChatInfo', () => api);
vi.mock('../../api/apiGetSessionSupervisors', () => api);
vi.mock('../../api/apiTeamDiscussion', () => api);

let membership = 'join';
let membershipListener: ((room: { roomId: string }) => void) | undefined;
const client = {
	getRoom: () => ({ getMyMembership: () => membership }),
	on: (_: string, fn: (room: { roomId: string }) => void) => {
		membershipListener = fn;
	},
	off: vi.fn()
};
const matrixService = {
	getClient: () => client,
	onClientChange: () => () => {}
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(() => {
	resetCaseHandoverPreviewGateCache();
	vi.clearAllMocks();
	membership = 'join';
	membershipListener = undefined;
});

const ME = 'me';
const card = (overrides: Record<string, unknown> = {}): any => ({
	id: 'a1',
	eventType: 'message.new',
	createdAt: '2026-10-28T10:00:00Z',
	sourceSessionId: '13',
	params: { roomRef: '!r:x', matrixEventId: '$e1' },
	...overrides
});
const sessionOwnedBy = (consultantId: string): any => ({
	session: { id: 13, matrixRoomId: '!r:x', groupId: '!r:x', status: 2 },
	consultant: { id: consultantId }
});

const hydrate = (feed: any[], sessions: any[]) => {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<UserDataContext.Provider
			value={
				{
					userData: {
						userId: ME,
						userName: ME,
						userRoles: ['consultant']
					}
				} as any
			}
		>
			<MatrixClientContext.Provider
				value={{ matrixClientService: matrixService } as any}
			>
				<SessionsDataContext.Provider value={{ sessions } as any}>
					{children}
				</SessionsDataContext.Provider>
			</MatrixClientContext.Provider>
		</UserDataContext.Provider>
	);
	return renderHook(() => useActivityPreviewHydration(feed), { wrapper });
};

describe('useActivityPreviewHydration (#924 / #1888)', () => {
	it.each([
		['group', 'provider'],
		['side', 'provider'],
		['group', 'client'],
		['side', 'client']
	] as const)(
		'does not reuse %s authorization during a Matrix %s replacement',
		async (kind, mode) => {
			const group = {
				chat: {
					id: 77,
					matrixRoomId: '!g:x',
					active: true,
					subscribed: true
				}
			};
			const item =
				kind === 'group'
					? card({
							params: { roomRef: '!g:x', matrixEventId: '$e1' }
						})
					: card({
							actionPath: '/session/13?channel=supervision',
							params: { roomRef: '!side:x', matrixEventId: '$e1' }
						});
			const sessions = kind === 'group' ? [group] : [sessionOwnedBy(ME)];
			const secondClient = { ...client };
			let currentClient = client;
			const listeners = new Set<(next: typeof client) => void>();
			let service: any = {
				getClient: () => currentClient,
				onClientChange: (listener: (next: typeof client) => void) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				}
			};
			const snapshots: boolean[] = [];
			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<UserDataContext.Provider
					value={{ userData: { userId: ME, userName: ME } } as any}
				>
					<MatrixClientContext.Provider
						value={{ matrixClientService: service } as any}
					>
						<SessionsDataContext.Provider
							value={{ sessions } as any}
						>
							{children}
						</SessionsDataContext.Provider>
					</MatrixClientContext.Provider>
				</UserDataContext.Provider>
			);
			const { result, rerender } = renderHook(
				() => {
					const value = useActivityPreviewHydration([item]);
					snapshots.push(value.sources.length > 0);
					return value;
				},
				{ wrapper }
			);
			await waitFor(() => expect(result.current.sources).toHaveLength(1));
			if (kind === 'group')
				api.apiGetGroupChatInfo.mockReturnValueOnce(
					new Promise(() => {})
				);
			else
				api.apiGetSessionSupervisors.mockReturnValueOnce(
					new Promise(() => {})
				);
			snapshots.length = 0;
			if (mode === 'provider') {
				service = {
					getClient: () => secondClient,
					onClientChange: () => () => {}
				};
				rerender();
			} else {
				act(() => {
					currentClient = secondClient;
					[...listeners].forEach((listener) =>
						listener(secondClient)
					);
				});
			}
			expect(snapshots[0]).toBe(false);
			expect(result.current.sources).toEqual([]);
		}
	);

	it('hydrates a card of my own case without asking for a status', () => {
		const { result } = hydrate([card()], [sessionOwnedBy(ME)]);
		expect(result.current.sources).toEqual([
			expect.objectContaining({
				activityEventId: 'a1',
				roomRef: '!r:x',
				matrixEventId: '$e1'
			})
		]);
		expect(api.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
		act(() => result.current.onPreviewChange('a1', 'Hallo', 'text'));
		expect(result.current.visiblePreview('a1')).toEqual({
			text: 'Hallo',
			kind: 'text'
		});
	});

	it('hydrates a colleague’s case only once its status allows it', async () => {
		const { result } = hydrate([card()], [sessionOwnedBy('colleague')]);
		expect(result.current.sources).toEqual([]);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
	});

	it('never hydrates a curtained case', async () => {
		api.apiGetCaseHandoverStatus.mockResolvedValueOnce({
			canViewContent: false
		});
		const { result } = hydrate([card()], [sessionOwnedBy('colleague')]);
		await waitFor(() =>
			expect(api.apiGetCaseHandoverStatus).toHaveBeenCalled()
		);
		expect(result.current.sources).toEqual([]);
		expect(result.current.visiblePreview('a1')).toBeUndefined();
	});

	it('fails closed for a card whose session is not loaded', () => {
		const { result } = hydrate([card({ sourceSessionId: undefined })], []);
		expect(result.current.sources).toEqual([]);
	});

	it('finds the session by room, so a group chat card hydrates without a session id', async () => {
		const groupChat: any = {
			chat: {
				id: 77,
				groupId: '!g:x',
				matrixRoomId: '!g:x',
				active: true,
				subscribed: true
			}
		};
		const { result } = hydrate(
			[
				card({
					sourceSessionId: undefined,
					params: {
						roomRef: '!g:x',
						matrixEventId: '$e1',
						seriesId: 77
					}
				})
			],
			[groupChat]
		);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		expect(api.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
	});

	it('blocks group previews before authorization and after membership is revoked', async () => {
		const group = {
			chat: {
				id: 77,
				matrixRoomId: '!g:x',
				active: true,
				subscribed: true
			}
		};
		const { result } = hydrate(
			[card({ params: { roomRef: '!g:x', matrixEventId: '$e1' } })],
			[group]
		);
		expect(result.current.sources).toEqual([]);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		act(() =>
			result.current.onPreviewChange('a1', 'private group text', 'text')
		);
		expect(result.current.visiblePreview('a1')?.text).toBe(
			'private group text'
		);
		act(() => {
			membership = 'ban';
			membershipListener?.({ roomId: '!g:x' });
		});
		expect(result.current.sources).toEqual([]);
		expect(result.current.visiblePreview('a1')).toBeUndefined();
	});

	it('blocks a group denied by its API', async () => {
		api.apiGetGroupChatInfo.mockRejectedValueOnce(new Error('forbidden'));
		const group = {
			chat: {
				id: 77,
				matrixRoomId: '!g:x',
				active: true,
				subscribed: true
			}
		};
		const { result } = hydrate(
			[card({ params: { roomRef: '!g:x', matrixEventId: '$e1' } })],
			[group]
		);
		await waitFor(() =>
			expect(api.apiGetGroupChatInfo).toHaveBeenCalledWith(77)
		);
		expect(result.current.sources).toEqual([]);
	});

	it('checks each group once even when multiple cards reference it', async () => {
		const group = {
			chat: {
				id: 77,
				matrixRoomId: '!g:x',
				active: true,
				subscribed: true
			}
		};
		const item = card({
			params: { roomRef: '!g:x', matrixEventId: '$e1' }
		});
		const { result } = hydrate([item, { ...item, id: 'a2' }], [group]);
		await waitFor(() => expect(result.current.sources).toHaveLength(2));
		expect(api.apiGetGroupChatInfo).toHaveBeenCalledTimes(1);
	});

	it.each([
		['supervision', '!side:x'],
		['team', '!team:x']
	])('authorizes a verified joined %s side room', async (channel, room) => {
		const item = card({
			actionPath: `/session/13?channel=${channel}`,
			params: { roomRef: room, matrixEventId: '$e1' }
		});
		const { result } = hydrate([item], [sessionOwnedBy(ME)]);
		expect(result.current.sources).toEqual([]);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
	});

	it('revokes a verified side room when membership is lost', async () => {
		const item = card({
			actionPath: '/session/13?channel=supervision',
			params: { roomRef: '!side:x', matrixEventId: '$e1' }
		});
		const { result } = hydrate([item], [sessionOwnedBy(ME)]);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		act(() => result.current.onPreviewChange('a1', 'side secret', 'text'));
		act(() => {
			membership = 'leave';
			membershipListener?.({ roomId: '!side:x' });
		});
		expect(result.current.sources).toEqual([]);
		expect(result.current.visiblePreview('a1')).toBeUndefined();
	});

	it('deduplicates side-room requests and preserves the handover denial', async () => {
		api.apiGetCaseHandoverStatus.mockResolvedValueOnce({
			canViewContent: false
		});
		const item = card({
			actionPath: '/session/13?channel=supervision',
			params: { roomRef: '!side:x', matrixEventId: '$e1' }
		});
		const { result } = hydrate(
			[item, { ...item, id: 'a2' }],
			[sessionOwnedBy('colleague')]
		);
		await waitFor(() =>
			expect(api.apiGetSessionSupervisors).toHaveBeenCalledWith(13)
		);
		await waitFor(() =>
			expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13)
		);
		expect(api.apiGetSessionSupervisors).toHaveBeenCalledTimes(1);
		expect(result.current.sources).toEqual([]);
	});

	it('denies a side channel that points to another case room', async () => {
		const item = card({
			actionPath: '/session/13?channel=supervision',
			params: { roomRef: '!other:x', matrixEventId: '$e1' }
		});
		const { result } = hydrate([item], [sessionOwnedBy(ME)]);
		await waitFor(() =>
			expect(api.apiGetSessionSupervisors).toHaveBeenCalledWith(13)
		);
		expect(result.current.sources).toEqual([]);
	});

	it('does not treat a different room as the case with the same numeric id', () => {
		const { result } = hydrate(
			[card({ params: { roomRef: '!g:x', matrixEventId: '$e1' } })],
			[sessionOwnedBy(ME)]
		);
		expect(result.current.sources).toEqual([]);
	});

	it('checks the room-resolved case rather than a conflicting event id', async () => {
		const { result } = hydrate(
			[card({ sourceSessionId: '99' })],
			[sessionOwnedBy('colleague')]
		);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
		expect(api.apiGetCaseHandoverStatus).not.toHaveBeenCalledWith(99);
	});

	it('checks a colleague’s case found by room under its own session id', async () => {
		const { result } = hydrate(
			[card({ sourceSessionId: undefined })],
			[sessionOwnedBy('colleague')]
		);
		await waitFor(() => expect(result.current.sources).toHaveLength(1));
		expect(api.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
	});

	it('ignores events that carry no message', () => {
		const { result } = hydrate(
			[
				card({ eventType: 'request.new' }),
				card({ id: 'a2', params: {} })
			],
			[sessionOwnedBy(ME)]
		);
		expect(result.current.sources).toEqual([]);
	});
});
