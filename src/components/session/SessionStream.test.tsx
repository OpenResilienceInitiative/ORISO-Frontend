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

const ROOM_ID = '!session:matrix.oriso.org';
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
		readActiveSession: vi.fn(),
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

const consultantUserData = {
	userId: 'consultant-1',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
} as any;

const accessControlledSession = (sessionId = 1) =>
	({
		rid: `${ROOM_ID}-${sessionId}`,
		isGroup: false,
		isSession: true,
		consultant: { id: 'owner-2' },
		item: {
			id: sessionId,
			matrixRoomId: `${ROOM_ID}-${sessionId}`,
			active: true,
			status: 2
		}
	}) as any;

type SessionStreamRenderOptions = {
	isGroup: boolean;
	notificationFeed?: any[];
	activeSession?: any;
	userData?: any;
};

const sessionStreamElement = ({
	isGroup,
	notificationFeed = [],
	activeSession = {
		rid: ROOM_ID,
		isGroup,
		isSession: !isGroup,
		item: {
			id: 1,
			matrixRoomId: ROOM_ID,
			active: true
		}
	} as any,
	userData = askerUserData
}: SessionStreamRenderOptions) => (
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
						userData,
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
									readActiveSession: mocks.readActiveSession
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

const renderSessionStream = (options: SessionStreamRenderOptions) =>
	render(sessionStreamElement(options));

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

const pendingHandoverStatus = (sessionId = 1) => ({
	sessionId,
	status: 'PENDING',
	canViewContent: false,
	clientConsentRequired: true,
	auditOutcome: 'CONSENT_REQUIRED'
});

const grantedHandoverStatus = (sessionId = 1) => ({
	sessionId,
	status: 'GRANTED',
	canViewContent: true,
	clientConsentRequired: false,
	auditOutcome: 'ACCESS_GRANTED'
});

const declinedHandoverStatus = (sessionId = 1) => ({
	sessionId,
	status: 'CLIENT_CONSENT_DECLINED',
	canViewContent: false,
	clientConsentRequired: true,
	auditOutcome: 'CLIENT_CONSENT_DECLINED'
});

const handoverNotification = (
	id: string,
	eventType: string,
	sessionId: string,
	readAt?: string
) => ({
	id,
	eventType,
	sourceSessionId: sessionId,
	readAt,
	type: 'info',
	title: 'Case handover',
	text: 'Case handover changed',
	createdAt: '2026-09-13T10:00:00.000Z',
	category: 'system'
});

const emitLifecycle = (change: any) => {
	act(() => {
		mocks.lifecycleListeners.forEach((listener) => listener(change));
	});
};

describe('SessionStream Matrix room lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getCaseHandoverStatus.mockReset();
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
				matrixRoomId: '!supervision:matrix.oriso.org'
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
				'!supervision:matrix.oriso.org'
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

	it('reconciles a same-session grant notification through a deferred authoritative status read before loading history once', async () => {
		const refreshedStatus = deferred<any>();
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockReturnValueOnce(refreshedStatus.promise);
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);

		await screen.findByTestId('case-handover-curtain');
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(1);
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();

		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [
					handoverNotification(
						'grant-1',
						'case.handover.granted',
						'1'
					)
				]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();

		await act(async () => refreshedStatus.resolve(grantedHandoverStatus()));

		await screen.findByTestId('session-item');
		expect(mocks.getMatrixRoomMessages).toHaveBeenCalledTimes(1);
	});

	it('keeps the curtain and loads no history after a same-session decline notification', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockResolvedValueOnce(declinedHandoverStatus());
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);

		await screen.findByTestId('case-handover-curtain');
		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [
					handoverNotification(
						'decline-1',
						'case.handover.consent.declined',
						'1'
					)
				]
			})
		);

		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();
	});

	it('does not let an older delayed grant override a newer locked result', async () => {
		const olderStatus = deferred<any>();
		const newerStatus = deferred<any>();
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockReturnValueOnce(olderStatus.promise)
			.mockReturnValueOnce(newerStatus.promise);
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);
		await screen.findByTestId('case-handover-curtain');

		const olderEvent = handoverNotification(
			'grant-older',
			'case.handover.granted',
			'1'
		);
		const newerEvent = handoverNotification(
			'decline-newer',
			'case.handover.consent.declined',
			'1'
		);
		view.rerender(
			sessionStreamElement({ ...options, notificationFeed: [olderEvent] })
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [newerEvent, olderEvent]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(3)
		);

		await act(async () => newerStatus.resolve(declinedHandoverStatus()));
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		await act(async () => olderStatus.resolve(grantedHandoverStatus()));

		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();
	});

	it('does not let an older delayed pending result relock a newer grant or load history twice', async () => {
		const olderStatus = deferred<any>();
		const newerStatus = deferred<any>();
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockReturnValueOnce(olderStatus.promise)
			.mockReturnValueOnce(newerStatus.promise);
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);
		await screen.findByTestId('case-handover-curtain');

		const olderEvent = handoverNotification(
			'decline-older',
			'case.handover.consent.declined',
			'1'
		);
		const newerEvent = handoverNotification(
			'grant-newer',
			'case.handover.granted',
			'1'
		);
		view.rerender(
			sessionStreamElement({ ...options, notificationFeed: [olderEvent] })
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [newerEvent, olderEvent]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(3)
		);

		await act(async () => newerStatus.resolve(grantedHandoverStatus()));
		await screen.findByTestId('session-item');
		expect(mocks.getMatrixRoomMessages).toHaveBeenCalledTimes(1);
		await act(async () => olderStatus.resolve(pendingHandoverStatus()));

		expect(screen.getByTestId('session-item')).toBeDefined();
		expect(screen.queryByTestId('case-handover-curtain')).toBeNull();
		expect(mocks.getMatrixRoomMessages).toHaveBeenCalledTimes(1);
	});

	it('ignores unrelated and other-session notifications but reconciles a read event only once by id', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValue(pendingHandoverStatus());
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);
		await screen.findByTestId('case-handover-curtain');

		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [
					handoverNotification('message-1', 'message.received', '1'),
					handoverNotification(
						'grant-elsewhere',
						'case.handover.granted',
						'2'
					)
				]
			})
		);
		await act(async () => Promise.resolve());
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(1);

		const readGrant = handoverNotification(
			'grant-read',
			'case.handover.granted',
			'1',
			'2026-09-13T10:01:00.000Z'
		);
		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [readGrant]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);

		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [{ ...readGrant }]
			})
		);
		await act(async () => Promise.resolve());
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2);
	});

	it('keeps a failed event retryable on window focus without retrying each feed snapshot', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValueOnce(pendingHandoverStatus());
		const notification = handoverNotification(
			'grant-retry',
			'case.handover.granted',
			'1'
		);
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: [notification]
		};
		const view = renderSessionStream({ ...options, notificationFeed: [] });
		await screen.findByTestId('case-handover-curtain');
		view.rerender(sessionStreamElement(options));
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);

		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [{ ...notification }]
			})
		);
		await act(async () => Promise.resolve());
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2);

		fireEvent(window, new Event('focus'));
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(3)
		);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
	});

	it('rejects a mismatched refreshed status instead of unlocking or loading history', async () => {
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockResolvedValueOnce(grantedHandoverStatus(999));
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);
		await screen.findByTestId('case-handover-curtain');

		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [
					handoverNotification(
						'grant-mismatch',
						'case.handover.granted',
						'1'
					)
				]
			})
		);

		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();
	});

	it('rejects a mismatched initial status instead of unlocking or loading history', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValueOnce(
			grantedHandoverStatus(999)
		);

		renderSessionStream({
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData
		});

		await screen.findByTestId('case-handover-curtain');
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();
	});

	it('does not watch handover notifications after the authoritative status is terminal', async () => {
		mocks.getCaseHandoverStatus.mockResolvedValueOnce(
			declinedHandoverStatus()
		);

		renderSessionStream({
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: [
				handoverNotification(
					'grant-terminal',
					'case.handover.granted',
					'1'
				)
			]
		});

		await screen.findByTestId('case-handover-curtain');
		await act(async () => Promise.resolve());
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(1);
	});

	it('does not watch handover notifications for a non-controlled asker session', async () => {
		renderSessionStream({
			isGroup: false,
			notificationFeed: [
				handoverNotification(
					'grant-not-controlled',
					'case.handover.granted',
					'1'
				)
			]
		});

		await screen.findByTestId('session-item');
		expect(mocks.getCaseHandoverStatus).not.toHaveBeenCalled();
	});

	it('does not watch handover notifications after supervision bypass is established', async () => {
		mocks.getSessionSupervisors.mockResolvedValueOnce([
			{
				supervisorConsultantId: 'consultant-1',
				supervisorUsername: 'supervisor@example.invalid',
				matrixRoomId: '!supervision:matrix.oriso.org'
			}
		]);
		mocks.getCaseHandoverStatus.mockResolvedValueOnce(
			pendingHandoverStatus()
		);

		renderSessionStream({
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: [
				handoverNotification(
					'grant-supervisor',
					'case.handover.granted',
					'1'
				)
			]
		});

		await screen.findByTestId('session-item');
		await act(async () => Promise.resolve());
		expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(1);
	});

	it('releases an unfinished event across A to B to A churn and accepts only the fresh grant', async () => {
		const oldStatus = deferred<any>();
		const freshStatus = deferred<any>();
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus(1))
			.mockReturnValueOnce(oldStatus.promise)
			.mockResolvedValueOnce(pendingHandoverStatus(2))
			.mockResolvedValueOnce(pendingHandoverStatus(1))
			.mockReturnValueOnce(freshStatus.promise);
		const notification = handoverNotification(
			'grant-late',
			'case.handover.granted',
			'1'
		);
		const firstSessionOptions = {
			isGroup: false,
			activeSession: accessControlledSession(1),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(firstSessionOptions);
		await screen.findByTestId('case-handover-curtain');
		view.rerender(
			sessionStreamElement({
				...firstSessionOptions,
				notificationFeed: [notification]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);

		view.rerender(
			sessionStreamElement({
				...firstSessionOptions,
				activeSession: accessControlledSession(2),
				notificationFeed: []
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(3)
		);
		view.rerender(
			sessionStreamElement({
				...firstSessionOptions,
				notificationFeed: [notification]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(4)
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(5)
		);

		await act(async () => oldStatus.resolve(grantedHandoverStatus(1)));
		expect(screen.getByTestId('case-handover-curtain')).toBeDefined();
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();

		await act(async () => freshStatus.resolve(grantedHandoverStatus(1)));
		await screen.findByTestId('session-item');
		expect(mocks.getMatrixRoomMessages).toHaveBeenCalledTimes(1);
	});

	it('ignores a late notification refresh after unmount', async () => {
		const lateStatus = deferred<any>();
		mocks.getCaseHandoverStatus
			.mockResolvedValueOnce(pendingHandoverStatus())
			.mockReturnValueOnce(lateStatus.promise);
		const options = {
			isGroup: false,
			activeSession: accessControlledSession(),
			userData: consultantUserData,
			notificationFeed: []
		};
		const view = renderSessionStream(options);
		await screen.findByTestId('case-handover-curtain');
		view.rerender(
			sessionStreamElement({
				...options,
				notificationFeed: [
					handoverNotification(
						'grant-unmount',
						'case.handover.granted',
						'1'
					)
				]
			})
		);
		await waitFor(() =>
			expect(mocks.getCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);

		view.unmount();
		await act(async () => lateStatus.resolve(grantedHandoverStatus()));
		expect(mocks.getMatrixRoomMessages).not.toHaveBeenCalled();
	});
});
