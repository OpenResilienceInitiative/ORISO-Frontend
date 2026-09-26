// @vitest-environment jsdom
import React from 'react';
import {
	render,
	screen,
	waitFor,
	act,
	cleanup,
	fireEvent,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	SessionTypeContext,
	UserDataContext,
	ConsultantListContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import { SessionStream } from './SessionStream';
import { chatTransportService } from '../../services/chatTransportService';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { apiDecideCaseHandoverClientConsent } from '../../api';

const ROOM_ID = '!session:matrix.example.org';
const LIST_PATH = '/sessions/user/view';

const mocks = vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';

	return {
		navigate: vi.fn(),
		logout: vi.fn(),
		lifecycleListeners: [] as ((change: any) => void)[],
		timelineListeners: [] as ((
			event: any,
			room: any,
			toStart: boolean
		) => void)[],
		detachLifecycle: vi.fn(),
		getMatrixRoomMessages: vi.fn(() => []),
		getSessionSupervisors: vi.fn(() => Promise.resolve([])),
		getCaseHandoverStatus: vi.fn(() =>
			Promise.resolve({
				sessionId: 1,
				status: 'GRANTED',
				canViewContent: true,
				clientConsentRequired: false,
				auditOutcome: 'ACCESS_GRANTED'
			})
		),
		resolveSession: vi.fn(() => ({
			isMatrixSession: true,
			matrixRoomId: ROOM_ID,
			sessionId: 1
		})),
		sessionItemProps: null as any,
		clientChangeListeners: [] as ((client: unknown) => void)[],
		matrixClientService: {
			getClient: () => null,
			onClientChange: (listener: (client: unknown) => void) => {
				mocks.clientChangeListeners.push(listener);
				return () => {
					const index = mocks.clientChangeListeners.indexOf(listener);
					if (index >= 0)
						mocks.clientChangeListeners.splice(index, 1);
				};
			}
		} as any,
		requestHistoryKeys: vi.fn(() => Promise.resolve(true))
	};
});

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-router-dom', async (importOriginal) => {
	const actual = await importOriginal<any>();
	return {
		...actual,
		useNavigate: () => mocks.navigate
	};
});

vi.mock('../../api', () => ({
	apiGetAgencyConsultantList: vi.fn(() => Promise.resolve([])),
	apiGetSessionSupervisors: mocks.getSessionSupervisors,
	apiGetCaseHandoverStatus: mocks.getCaseHandoverStatus,
	apiDecideCaseHandoverClientConsent: vi.fn(() => Promise.resolve({})),
	FETCH_ERRORS: { ABORT: 'ABORT' }
}));

vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: {
		resolveSession: mocks.resolveSession,
		getMatrixRoom: vi.fn(() => null),
		getMatrixRoomMessages: mocks.getMatrixRoomMessages,
		sendTyping: vi.fn(() => Promise.resolve()),
		markRoomAsRead: vi.fn(() => Promise.resolve()),
		onMatrixTimeline: vi.fn(
			(
				_roomId: string,
				listener: (event: any, room: any, toStart: boolean) => void
			) => {
				mocks.timelineListeners.push(listener);
				return () => {
					const index = mocks.timelineListeners.indexOf(listener);
					if (index >= 0) mocks.timelineListeners.splice(index, 1);
				};
			}
		),
		onMatrixRoomLifecycle: vi.fn(
			(_roomId: string, listener: (change: any) => void) => {
				mocks.lifecycleListeners.push(listener);
				return mocks.detachLifecycle;
			}
		)
	}
}));

vi.mock(
	'../../services/matrixRoomHistoryKeyTransfer',
	async (importOriginal) => {
		const actual = await importOriginal<any>();
		return {
			...actual,
			matrixRoomHistoryKeyTransfer: {
				requestKeys: mocks.requestHistoryKeys
			}
		};
	}
);

// The globalState barrel drags in the entire registration UI; provide just
// the contexts and helpers SessionStream consumes.
vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		AUTHORITIES: {
			ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT',
			CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT'
		},
		hasUserAuthority: (authority: string, userData: any) =>
			Boolean(userData?.grantedAuthorities?.includes(authority)),
		ConsultantListContext: ReactModule.createContext({
			consultantList: [],
			setConsultantList: () => {}
		}),
		SessionTypeContext: ReactModule.createContext(null),
		UserDataContext: ReactModule.createContext(null),
		ActiveSessionContext: ReactModule.createContext(null),
		useTopic: () => null
	};
});

vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({
		matrixClientService: mocks.matrixClientService
	})
}));

vi.mock('./SessionItemComponent', () => ({
	SessionItemComponent: (props: any) => {
		mocks.sessionItemProps = props;
		return <div data-testid="session-item" />;
	}
}));

vi.mock('./CaseHandoverGate', () => ({
	CaseHandoverGate: () => <div data-testid="case-handover-gate" />
}));

vi.mock('./CaseHandoverCurtain', () => ({
	CaseHandoverCurtain: () => <div data-testid="case-handover-curtain" />
}));

vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {
		CLOSE: 'CLOSE',
		REDIRECT: 'REDIRECT',
		LOGOUT: 'LOGOUT'
	},
	Overlay: ({ item }: any) => (
		<div data-testid="overlay">{item?.headline}</div>
	)
}));

vi.mock('../logout/logout', () => ({
	logout: mocks.logout
}));

const askerUserData = {
	userId: 'asker-1',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
} as any;

const renderSessionStream = ({
	isGroup,
	notificationFeed = []
}: {
	isGroup: boolean;
	notificationFeed?: any[];
}) => {
	const activeSession = {
		rid: ROOM_ID,
		isGroup,
		isSession: !isGroup,
		item: {
			id: 1,
			matrixRoomId: ROOM_ID,
			active: true
		}
	} as any;

	return render(
		<MemoryRouter>
			<NotificationsContext.Provider
				value={
					{
						notificationFeed,
						markNotificationAsRead: vi.fn(),
						refreshNotificationFeed: vi.fn()
					} as any
				}
			>
				<UserDataContext.Provider
					value={
						{
							userData: askerUserData,
							setUserData: () => {}
						} as any
					}
				>
					<SessionTypeContext.Provider
						value={{
							type: SESSION_LIST_TYPES.MY_SESSION,
							path: LIST_PATH
						}}
					>
						<ConsultantListContext.Provider
							value={
								{
									consultantList: [],
									setConsultantList: () => {}
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession,
										readActiveSession: () => {}
									} as any
								}
							>
								<SessionStream
									readonly={false}
									checkMutedUserForThisSession={() => {}}
									bannedUsers={[]}
								/>
							</ActiveSessionContext.Provider>
						</ConsultantListContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
};

const emitLifecycle = (change: any) => {
	act(() => {
		mocks.lifecycleListeners.forEach((listener) => listener(change));
	});
};

describe('SessionStream Matrix room lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.lifecycleListeners.length = 0;
		mocks.timelineListeners.length = 0;
		mocks.clientChangeListeners.length = 0;
		mocks.sessionItemProps = null;
		mocks.getCaseHandoverStatus.mockResolvedValue({
			sessionId: 1,
			status: 'GRANTED',
			canViewContent: true,
			clientConsentRequired: false,
			auditOutcome: 'ACCESS_GRANTED'
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('lets the asker decide pending case-handover consent inside the conversation', async () => {
		renderSessionStream({
			isGroup: false,
			notificationFeed: [
				{
					id: '1481',
					eventType: 'case.handover.consent.requested',
					sourceSessionId: '1',
					actionPath:
						'/sessions/user/view/session/1?caseHandoverRequestId=11'
				}
			]
		});

		const consentCard = await screen.findByTestId(
			'case-handover-inline-consent'
		);
		fireEvent.click(
			within(consentCard).getByRole('button', {
				name: 'caseHandover.consent.approve'
			})
		);

		await waitFor(() => {
			expect(apiDecideCaseHandoverClientConsent).toHaveBeenCalledWith(
				1,
				11,
				true
			);
		});
	});

	it('does not inject a standalone team-access message into an ordinary counselling session', async () => {
		renderSessionStream({ isGroup: false });

		await waitFor(() => {
			expect(mocks.sessionItemProps).not.toBeNull();
		});
		expect(mocks.sessionItemProps).not.toHaveProperty('systemMessages');
	});

	it('lets the asker decline the request and removes the card afterwards', async () => {
		renderSessionStream({
			isGroup: false,
			notificationFeed: [
				{
					id: '1481',
					eventType: 'case.handover.consent.requested',
					sourceSessionId: '1',
					actionPath:
						'/sessions/user/view/session/1?caseHandoverRequestId=11'
				}
			]
		});

		const consentCard = await screen.findByTestId(
			'case-handover-inline-consent'
		);
		fireEvent.click(
			within(consentCard).getByRole('button', {
				name: 'caseHandover.consent.decline'
			})
		);

		await waitFor(() => {
			expect(apiDecideCaseHandoverClientConsent).toHaveBeenCalledWith(
				1,
				11,
				false
			);
		});
		await waitFor(() => {
			expect(
				screen.queryByTestId('case-handover-inline-consent')
			).toBeNull();
		});
	});

	it('does not resurface the card for an already-answered (read) request', async () => {
		renderSessionStream({
			isGroup: false,
			notificationFeed: [
				{
					id: '1481',
					eventType: 'case.handover.consent.requested',
					sourceSessionId: '1',
					readAt: '2026-08-01T10:00:00.000Z',
					actionPath:
						'/sessions/user/view/session/1?caseHandoverRequestId=11'
				}
			]
		});

		await waitFor(() => {
			expect(screen.getByTestId('session-item')).toBeDefined();
		});
		expect(screen.queryByTestId('case-handover-inline-consent')).toBeNull();
	});

	it('redirects a removed 1:1 participant back to the session list', async () => {
		renderSessionStream({ isGroup: false });

		await waitFor(() => {
			expect(screen.getByTestId('session-item')).toBeDefined();
		});
		await waitFor(() => {
			expect(mocks.lifecycleListeners.length).toBeGreaterThan(0);
		});

		emitLifecycle({
			type: 'myMembership',
			membership: 'leave',
			prevMembership: 'join'
		});

		expect(mocks.navigate).toHaveBeenCalledWith(LIST_PATH);
	});

	it('shows the "group chat stopped" overlay when a group room is ended', async () => {
		renderSessionStream({ isGroup: true });

		await waitFor(() => {
			expect(screen.getByTestId('session-item')).toBeDefined();
		});
		await waitFor(() => {
			expect(mocks.lifecycleListeners.length).toBeGreaterThan(0);
		});

		emitLifecycle({ type: 'tombstoned' });

		await waitFor(() => {
			expect(screen.getByTestId('overlay').textContent).toBe(
				'groupChat.stopped.overlay.headline'
			);
		});
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it('re-attaches room listeners after a token refresh swaps the Matrix client', async () => {
		renderSessionStream({ isGroup: true });

		await waitFor(() => {
			expect(mocks.lifecycleListeners.length).toBeGreaterThan(0);
		});
		const lifecycleAttachesBefore = vi.mocked(
			chatTransportService.onMatrixRoomLifecycle
		).mock.calls.length;
		const timelineAttachesBefore = vi.mocked(
			chatTransportService.onMatrixTimeline
		).mock.calls.length;

		// A token refresh replaces the matrix-js-sdk client instance; the old
		// one got removeAllListeners(), so SessionStream must re-attach every
		// room listener to the replacement client.
		act(() => {
			mocks.clientChangeListeners.forEach((listener) => listener({}));
		});

		await waitFor(() => {
			expect(
				vi.mocked(chatTransportService.onMatrixRoomLifecycle).mock.calls
					.length
			).toBeGreaterThan(lifecycleAttachesBefore);
		});
		expect(
			vi.mocked(chatTransportService.onMatrixTimeline).mock.calls.length
		).toBeGreaterThan(timelineAttachesBefore);
		expect(mocks.detachLifecycle).toHaveBeenCalled();

		// The freshly attached listener must still drive the stopped overlay.
		emitLifecycle({ type: 'tombstoned' });
		await waitFor(() => {
			expect(screen.getByTestId('overlay').textContent).toBe(
				'groupChat.stopped.overlay.headline'
			);
		});
	});

	it('suppresses the overlay when this user initiated the stop/leave themselves', async () => {
		renderSessionStream({ isGroup: true });

		await waitFor(() => {
			expect(mocks.lifecycleListeners.length).toBeGreaterThan(0);
		});
		await waitFor(() => {
			expect(mocks.sessionItemProps).not.toBeNull();
		});

		// SessionMenu sets this ref before calling the stop/leave API; the
		// self-initiated flow already shows its own success overlay.
		mocks.sessionItemProps.hasUserInitiatedStopOrLeaveRequest.current = true;

		emitLifecycle({
			type: 'myMembership',
			membership: 'leave',
			prevMembership: 'join'
		});

		expect(screen.queryByTestId('overlay')).toBeNull();
		// The flag is consumed so a later external stop still notifies.
		expect(
			mocks.sessionItemProps.hasUserInitiatedStopOrLeaveRequest.current
		).toBe(false);
	});

	it('detaches the lifecycle listener on unmount', async () => {
		const { unmount } = renderSessionStream({ isGroup: false });

		await waitFor(() => {
			expect(mocks.lifecycleListeners.length).toBeGreaterThan(0);
		});

		unmount();
		expect(mocks.detachLifecycle).toHaveBeenCalled();
	});

	it('refreshes a clear message when delayed decryption lands inside the coalescing window', async () => {
		renderSessionStream({ isGroup: true });

		await waitFor(() => {
			expect(mocks.timelineListeners.length).toBe(1);
		});
		const callsBeforeTimelineEvents =
			mocks.getMatrixRoomMessages.mock.calls.length;
		const encryptedEvent = { getType: () => 'm.room.encrypted' };
		const decryptedEvent = { getType: () => 'm.room.message' };
		const room = { roomId: ROOM_ID };

		act(() => {
			mocks.timelineListeners.forEach((listener) => {
				listener(encryptedEvent, room, false);
				listener(decryptedEvent, room, false);
			});
		});

		await waitFor(
			() => {
				expect(mocks.getMatrixRoomMessages).toHaveBeenCalledTimes(
					callsBeforeTimelineEvents + 2
				);
			},
			{ timeout: 500 }
		);
	});

	it('hydrates the initial timeline after its listener attaches', async () => {
		let callsAtAttach = -1;
		vi.mocked(chatTransportService.onMatrixTimeline).mockImplementationOnce(
			(_roomId: string, listener: any) => {
				callsAtAttach = mocks.getMatrixRoomMessages.mock.calls.length;
				mocks.timelineListeners.push(listener);
				return () => undefined;
			}
		);

		renderSessionStream({ isGroup: true });

		await waitFor(() => expect(callsAtAttach).toBeGreaterThanOrEqual(0));
		await waitFor(() =>
			expect(
				mocks.getMatrixRoomMessages.mock.calls.length
			).toBeGreaterThan(callsAtAttach)
		);
		expect(mocks.requestHistoryKeys).toHaveBeenCalledWith(ROOM_ID);
	});

	it('does not curtain a backend-authorized session supervisor', async () => {
		mocks.getSessionSupervisors.mockResolvedValueOnce([
			{
				id: 7,
				supervisorConsultantId: 'supervisor-1',
				supervisorUsername: 'supervisor@example.invalid',
				matrixRoomId: '!supervision:matrix.example.org'
			}
		]);
		const activeSession = {
			rid: ROOM_ID,
			isGroup: false,
			isSession: true,
			consultant: { id: 'owner-2' },
			item: { id: 1, matrixRoomId: ROOM_ID, active: true, status: 2 }
		} as any;
		const consultantUserData = {
			userId: 'supervisor-1',
			grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
		} as any;

		render(
			<MemoryRouter>
				<UserDataContext.Provider
					value={{ userData: consultantUserData } as any}
				>
					<SessionTypeContext.Provider
						value={{
							type: SESSION_LIST_TYPES.MY_SESSION,
							path: LIST_PATH
						}}
					>
						<ConsultantListContext.Provider
							value={
								{
									consultantList: [],
									setConsultantList: () => {}
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession,
										readActiveSession: () => {}
									} as any
								}
							>
								<SessionStream
									readonly={false}
									checkMutedUserForThisSession={() => {}}
									bannedUsers={[]}
								/>
							</ActiveSessionContext.Provider>
						</ConsultantListContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</MemoryRouter>
		);

		await waitFor(() =>
			expect(screen.getByTestId('session-item')).toBeDefined()
		);
		expect(screen.queryByTestId('case-handover-curtain')).toBeNull();
		await waitFor(() => {
			expect(mocks.requestHistoryKeys).toHaveBeenCalledWith(ROOM_ID);
			expect(mocks.requestHistoryKeys).toHaveBeenCalledWith(
				'!supervision:matrix.example.org'
			);
		});
	});

	it('does not attach or request history before case handover is granted', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValueOnce({
			sessionId: 1,
			status: 'PENDING',
			canViewContent: false,
			clientConsentRequired: true,
			auditOutcome: 'CONSENT_REQUIRED'
		});
		const activeSession = {
			rid: ROOM_ID,
			isGroup: false,
			isSession: true,
			consultant: { id: 'owner-2' },
			item: { id: 1, matrixRoomId: ROOM_ID, active: true, status: 2 }
		} as any;
		const consultantUserData = {
			userId: 'consultant-1',
			grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
		} as any;

		render(
			<MemoryRouter>
				<UserDataContext.Provider
					value={{ userData: consultantUserData } as any}
				>
					<SessionTypeContext.Provider
						value={{
							type: SESSION_LIST_TYPES.MY_SESSION,
							path: LIST_PATH
						}}
					>
						<ConsultantListContext.Provider
							value={
								{
									consultantList: [],
									setConsultantList: () => {}
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession,
										readActiveSession: () => {}
									} as any
								}
							>
								<SessionStream
									readonly={false}
									checkMutedUserForThisSession={() => {}}
									bannedUsers={[]}
								/>
							</ActiveSessionContext.Provider>
						</ConsultantListContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</MemoryRouter>
		);

		await waitFor(() =>
			expect(screen.getByTestId('case-handover-curtain')).toBeDefined()
		);
		expect(mocks.requestHistoryKeys).not.toHaveBeenCalled();
		expect(chatTransportService.onMatrixTimeline).not.toHaveBeenCalled();
	});
});

describe('SessionStream — co-access expiry (#200)', () => {
	const NOW = new Date('2026-09-25T07:00:00Z');
	const coAccess = (sessionId: number, expiresAt: string) => ({
		sessionId,
		requestId: 38,
		status: 'GRANTED',
		canViewContent: true,
		clientConsentRequired: false,
		accessType: 'CO_ACCESS',
		expiresAt
	});
	const expired = (sessionId: number) => ({
		sessionId,
		requestId: 38,
		status: 'EXPIRED',
		canViewContent: false,
		clientConsentRequired: false,
		accessType: 'CO_ACCESS'
	});

	const tree = (sessionId: number, ownerId = 'owner-2') => (
		<MemoryRouter>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'consultant-1',
							grantedAuthorities: [
								'AUTHORIZATION_CONSULTANT_DEFAULT'
							]
						}
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: LIST_PATH
					}}
				>
					<ConsultantListContext.Provider
						value={
							{
								consultantList: [],
								setConsultantList: () => {}
							} as any
						}
					>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession: {
										rid: ROOM_ID,
										isGroup: false,
										isSession: true,
										consultant: { id: ownerId },
										item: {
											id: sessionId,
											matrixRoomId: ROOM_ID,
											active: true,
											status: 2
										}
									},
									readActiveSession: () => {}
								} as any
							}
						>
							<SessionStream
								readonly={false}
								checkMutedUserForThisSession={() => {}}
								bannedUsers={[]}
							/>
						</ActiveSessionContext.Provider>
					</ConsultantListContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

	const advance = (ms: number) =>
		act(async () => {
			await vi.advanceTimersByTimeAsync(ms);
		});
	const statusCallsFor = (sessionId: number) =>
		mocks.getCaseHandoverStatus.mock.calls.filter(
			(call: any[]) => call[0] === sessionId
		).length;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		vi.setSystemTime(NOW);
		mocks.sessionItemProps = null;
		mocks.timelineListeners.length = 0;
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('asks again 5 s after co-access expires and closes the curtain', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(coAccess(1, '2026-09-25T07:10:00'))
			.mockResolvedValueOnce(expired(1));

		render(tree(1));
		await advance(0);
		expect(screen.getByTestId('session-item')).toBeDefined();
		expect(statusCallsFor(1)).toBe(1);
		expect(mocks.timelineListeners.length).toBeGreaterThan(0);

		await advance(10 * 60_000 + 4_999);
		expect(statusCallsFor(1)).toBe(1);

		await advance(1);
		expect(statusCallsFor(1)).toBe(2);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(screen.queryByTestId('session-item')).toBeNull();
		// New Matrix events stop arriving once access ends.
		expect(mocks.timelineListeners.length).toBe(0);
	});

	it('asks right away when the expiry has already passed', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(coAccess(1, '2026-09-25T06:59:00'))
			.mockResolvedValueOnce(expired(1));

		render(tree(1));
		await advance(0);
		await advance(0);

		expect(statusCallsFor(1)).toBe(2);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
	});

	it('waits past the setTimeout maximum instead of firing early', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(coAccess(1, '2026-10-25T07:00:00'))
			.mockResolvedValueOnce(expired(1));

		render(tree(1));
		await advance(0);
		await advance(2 ** 31 - 1);
		expect(statusCallsFor(1)).toBe(1);

		await advance(30 * 24 * 60 * 60_000 + 5_000 - (2 ** 31 - 1));
		expect(statusCallsFor(1)).toBe(2);
	});

	it('clears the timer on unmount', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValueOnce(
			coAccess(1, '2026-09-25T07:10:00')
		);

		const { unmount } = render(tree(1));
		await advance(0);
		unmount();
		await advance(11 * 60_000);

		expect(statusCallsFor(1)).toBe(1);
	});

	it('clears the timer when another session opens', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(coAccess(1, '2026-09-25T07:10:00'))
			.mockResolvedValueOnce({
				sessionId: 2,
				status: 'PENDING',
				canViewContent: false,
				clientConsentRequired: false
			});

		const { rerender } = render(tree(1));
		await advance(0);
		rerender(tree(2));
		await advance(11 * 60_000);

		expect(statusCallsFor(1)).toBe(1);
		expect(statusCallsFor(2)).toBe(1);
	});

	it('schedules nothing for a TAKEOVER recipient', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValueOnce({
			...coAccess(1, '2026-09-25T07:10:00'),
			accessType: 'TAKEOVER'
		});

		render(tree(1));
		await advance(0);
		await advance(24 * 60 * 60_000);

		expect(statusCallsFor(1)).toBe(1);
	});

	it('schedules nothing for the case owner', async () => {
		render(tree(1, 'consultant-1'));
		await advance(24 * 60 * 60_000);

		expect(mocks.getCaseHandoverStatus).not.toHaveBeenCalled();
	});
});
