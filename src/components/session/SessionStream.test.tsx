// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
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
		resolveSession: vi.fn(() => ({
			isMatrixSession: true,
			matrixRoomId: ROOM_ID,
			sessionId: 1
		})),
		sessionItemProps: null as any
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
	apiGetCaseHandoverStatus: vi.fn(() =>
		Promise.resolve({
			sessionId: 1,
			status: 'GRANTED',
			canViewContent: true,
			clientConsentRequired: false,
			auditOutcome: 'ACCESS_GRANTED'
		})
	),
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
	useMatrixClient: () => ({ matrixClientService: null })
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

const renderSessionStream = ({ isGroup }: { isGroup: boolean }) => {
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
			<UserDataContext.Provider
				value={
					{ userData: askerUserData, setUserData: () => {} } as any
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
		mocks.sessionItemProps = null;
	});

	afterEach(() => {
		cleanup();
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
});
