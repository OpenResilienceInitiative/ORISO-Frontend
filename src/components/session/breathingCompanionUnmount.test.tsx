// @vitest-environment oriso-jsdom
/**
 * The breathing companion's host contract (`BreathingCompanion.tsx`) says:
 * "When counselling starts, UNMOUNT the component." The live chat entry room
 * honours it with `companionOpen = companion && !accepted`; the session view
 * used to claim the same in a comment while its render gate was derived from
 * modality and roles only, so an accepted counsellor found the companion still
 * running with its audio and animation frames. These tests pin the gate.
 */
import React from 'react';
import {
	render,
	screen,
	act,
	cleanup,
	fireEvent,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { SessionItemComponent } from './SessionItemComponent';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import { apiPatchNotificationActiveView } from '../../api/apiPatchNotificationActiveView';

import { apiPutSessionData } from '../../api/apiPutSessionData';
import { apiPatchUserData } from '../../api/apiPatchUserData';
const reloadLegacySession = vi.fn();
const aliasPolicy = vi.hoisted(() => ({ featureDisplayNameEditable: true }));
const SESSION_ID = 4711;
const ROOM_ID = '!live-chat:matrix.example.org';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : _key
	})
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		AUTHORITIES: {
			ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT',
			CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT'
		},
		hasUserAuthority: (authority: string, userData: any) =>
			Boolean(userData?.grantedAuthorities?.includes(authority)),
		getContact: () => ({ username: 'Beraterin' }),
		useTenant: () => ({ settings: aliasPolicy }),
		// Added when the side room's call controls landed: `SessionItemComponent`
		// asks the consulting type whether calls are allowed at all. This test
		// and that import came from two different branches and only met in the
		// merge, which is why it was green on either side alone.
		useConsultingType: () => null,
		NOTIFICATION_TYPE_INFO: 'INFO',
		NotificationsContext: ReactModule.createContext({
			addEventNotification: () => {}
		}),
		UserDataContext: ReactModule.createContext(null),
		SessionTypeContext: ReactModule.createContext(null),
		ActiveSessionContext: ReactModule.createContext(null),
		LocaleContext: ReactModule.createContext({ locale: 'de' })
	};
});

vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: undefined })
}));

vi.mock('../../globalState/provider/LegalLinksProvider', async () => {
	const ReactModule = await import('react');
	return { LegalLinksContext: ReactModule.createContext([]) };
});

/* Children that would drag in TipTap, MUI dialogs, Tone.js or the Matrix SDK.
   The companion host is the subject of the assertions, so it gets a testid. */
vi.mock('../pseudonym/breathingCompanion/BreathingCompanionHost', () => ({
	BreathingCompanionHost: () => <div data-testid="breathing-companion" />
}));

vi.mock('../pseudonym/WaitingQueueActionBar', () => ({
	WaitingQueueActionBar: ({ onOpenCalmCompanion }: any) => (
		<button type="button" onClick={onOpenCalmCompanion}>
			open-companion
		</button>
	)
}));

vi.mock('../pseudonym/PseudonymCard', async (original) => {
	const real = await original<typeof import('../pseudonym/PseudonymCard')>();
	return {
		PseudonymCard: (
			props: React.ComponentProps<typeof real.PseudonymCard>
		) => <real.PseudonymCard {...props} skipTyping />
	};
});
vi.mock('../pseudonym/PrivacyMessageCard', () => ({
	PrivacyMessageCard: () => <div data-testid="privacy-card" />
}));

vi.mock('../pseudonym/AnonymousConsentGate', () => ({
	AnonymousConsentGate: () => <div data-testid="consent-gate" />
}));
vi.mock('../pseudonym/LeaveQueueDialog', () => ({
	LeaveQueueDialog: () => null
}));
vi.mock('../pseudonym/ConsultantAcceptedActionBar', () => ({
	ConsultantAcceptedActionBar: () => (
		<div data-testid="consultant-accepted-bar" />
	)
}));
vi.mock('../sessionHeader/SessionHeaderComponent', () => ({
	SessionHeaderComponent: () => <div data-testid="session-header" />
}));
vi.mock('./EncryptionBanner', () => ({
	EncryptionBanner: () => null
}));
vi.mock('./ThreadListPanel', () => ({ ThreadListPanel: () => null }));
vi.mock('./AcceptAssign', () => ({ AcceptAssign: () => null }));
vi.mock('../message/MessageItemComponent', () => ({
	MessageItemComponent: () => null
}));
vi.mock('../dragAndDropArea/DragAndDropArea', () => ({
	DragAndDropArea: ({ children }: any) => <div>{children}</div>
}));
vi.mock('../messageSubmitInterface/messageSubmitInterfaceComponent', () => ({
	MessageSubmitInterfaceComponent: () => null
}));
vi.mock('../messageSubmitInterface/MessageSubmitErrorBoundary', () => ({
	MessageSubmitErrorBoundary: ({ children }: any) => <>{children}</>
}));
vi.mock('../messageSubmitInterface/messageSubmitInterfaceSkeleton', () => ({
	MessageSubmitInterfaceSkeleton: () => null
}));

vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({
		key: null,
		keyID: null,
		encrypted: false,
		subscriptionKeyLost: false,
		ready: true
	})
}));
vi.mock('../../hooks/useMatrixDecryptionFailures', () => ({
	useMatrixDecryptionFailures: () => new Set()
}));

vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: {
		sendReaction: vi.fn(() => Promise.resolve()),
		removeReaction: vi.fn(() => Promise.resolve()),
		markRoomAsRead: vi.fn(() => Promise.resolve())
	}
}));

vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: vi.fn(() => Promise.resolve([]))
}));
vi.mock('../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn(() => new Promise(() => {}))
}));
vi.mock('../../api/apiPatchNotificationActiveView', () => ({
	apiPatchNotificationActiveView: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiMatrixSyncRegister', () => ({
	apiRegisterMatrixRoomForSync: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiPutSessionData', () => ({
	apiPutSessionData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiGetUserData', () => ({
	apiGetUserData: vi.fn(() => Promise.resolve({}))
}));
vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn(() => Promise.resolve()),
	TError: {}
}));

const askerUserData = {
	userId: 'asker-1',
	userName: 'anon_7',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	userRoles: ['USER'],
	dataPrivacyConfirmation: '2026-09-06T10:00:00Z'
} as any;

const buildActiveSession = (status: number, sessionId = SESSION_ID) =>
	({
		rid: ROOM_ID,
		isGroup: false,
		isSession: true,
		user: { username: 'anon_7' },
		consultant: { id: 'consultant-1', username: 'Beraterin' },
		item: {
			id: sessionId,
			matrixRoomId: ROOM_ID,
			conversationType: 'LIVE_CHAT',
			status,
			active: true,
			askerMatrixUserId: '@anon_7:matrix.example.org'
		}
	}) as any;

const sessionElement = (
	status: number,
	userData = askerUserData,
	path = '/',
	sessionId = SESSION_ID
) => (
	<MemoryRouter initialEntries={[path]}>
		<NotificationsContext.Provider
			value={{ addEventNotification: vi.fn() } as any}
		>
			<UserDataContext.Provider
				value={{ userData, setUserData: vi.fn() } as any}
			>
				<SessionTypeContext.Provider
					value={{ type: SESSION_LIST_TYPES.MY_SESSION } as any}
				>
					<ActiveSessionContext.Provider
						value={
							{
								activeSession: buildActiveSession(
									status,
									sessionId
								),
								reloadActiveSession: reloadLegacySession
							} as any
						}
					>
						<SessionItemComponent
							typingUsers={[]}
							bannedUsers={[]}
							messages={[]}
							hasUserInitiatedStopOrLeaveRequest={{
								current: false
							}}
						/>
					</ActiveSessionContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	</MemoryRouter>
);

const renderSession = (status: number, userData = askerUserData, path = '/') =>
	render(sessionElement(status, userData, path));

describe('SessionItemComponent — breathing companion lifetime', () => {
	beforeEach(() => {
		sessionStorage.clear();
		// Consent and pseudonym already confirmed: the anonymous asker sits in
		// the waiting queue, which is where the companion can be opened.
		sessionStorage.setItem(`anonymous-inquiry-consent-${SESSION_ID}`, '1');
		sessionStorage.setItem(`anonymous-pseudonym-${SESSION_ID}`, '1');
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('mounts the companion while the asker is still waiting', async () => {
		renderSession(1 /* STATUS_ENQUIRY */);

		expect(screen.queryByTestId('breathing-companion')).toBeNull();
		await act(async () => {
			fireEvent.click(screen.getByText('open-companion'));
		});

		expect(screen.getByTestId('breathing-companion')).toBeTruthy();
	});

	it('unmounts the companion as soon as a counsellor has accepted', async () => {
		const { rerender } = renderSession(1 /* STATUS_ENQUIRY */);

		await act(async () => {
			fireEvent.click(screen.getByText('open-companion'));
		});
		expect(screen.getByTestId('breathing-companion')).toBeTruthy();

		/* Acceptance: the session leaves the enquiry phase, which is what flips
		   `consultantAccepted`. `isAnonymousBreathingGameAvailable` is still
		   true here — modality and roles have not changed — so only the
		   acceptance condition can take the companion down. */
		await act(async () => {
			rerender(
				<MemoryRouter>
					<NotificationsContext.Provider
						value={{ addEventNotification: vi.fn() } as any}
					>
						<UserDataContext.Provider
							value={
								{
									userData: askerUserData,
									setUserData: vi.fn()
								} as any
							}
						>
							<SessionTypeContext.Provider
								value={
									{
										type: SESSION_LIST_TYPES.MY_SESSION
									} as any
								}
							>
								<ActiveSessionContext.Provider
									value={
										{
											activeSession: buildActiveSession(
												2 /* STATUS_ACTIVE */
											),
											reloadActiveSession: vi.fn()
										} as any
									}
								>
									<SessionItemComponent
										typingUsers={[]}
										bannedUsers={[]}
										messages={[]}
										hasUserInitiatedStopOrLeaveRequest={{
											current: false
										}}
									/>
								</ActiveSessionContext.Provider>
							</SessionTypeContext.Provider>
						</UserDataContext.Provider>
					</NotificationsContext.Provider>
				</MemoryRouter>
			);
		});

		expect(screen.queryByTestId('breathing-companion')).toBeNull();
	});
});

describe('SessionItemComponent — notification active-view lifecycle', () => {
	const consultantUserData = {
		userId: 'consultant-1',
		userName: 'counsellor',
		grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
		userRoles: ['CONSULTANT']
	} as any;
	const conversationPath = `/sessions/consultant/sessionView/${ROOM_ID}/${SESSION_ID}`;
	let visibility: DocumentVisibilityState;
	let focused: boolean;
	beforeEach(() => {
		vi.useFakeTimers();
		visibility = 'hidden';
		focused = true;
		vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibility
		);
		vi.mocked(apiPatchNotificationActiveView).mockClear();
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('does not suppress incoming notifications in a visible but unfocused Live Chat', async () => {
		visibility = 'visible';
		focused = false;
		renderSession(2, consultantUserData, conversationPath);
		await act(async () => vi.advanceTimersByTime(10000));
		expect(
			vi
				.mocked(apiPatchNotificationActiveView)
				.mock.calls.some(([request]) => request.active)
		).toBe(false);
	});

	it('releases suppression on blur and resumes it on focus without mounting the chat again', async () => {
		visibility = 'visible';
		renderSession(2, consultantUserData, conversationPath);
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: true
		});
		focused = false;
		act(() => window.dispatchEvent(new Event('blur')));
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: false
		});
		vi.mocked(apiPatchNotificationActiveView).mockClear();
		await act(async () => vi.advanceTimersByTime(10000));
		expect(
			vi
				.mocked(apiPatchNotificationActiveView)
				.mock.calls.some(([request]) => request.active)
		).toBe(false);
		focused = true;
		act(() => window.dispatchEvent(new Event('focus')));
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: true
		});
	});

	it('releases suppression when the tab becomes hidden and resumes only when visible and focused', () => {
		visibility = 'visible';
		renderSession(2, consultantUserData, conversationPath);
		visibility = 'hidden';
		act(() => document.dispatchEvent(new Event('visibilitychange')));
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: false
		});
		visibility = 'visible';
		focused = false;
		act(() => document.dispatchEvent(new Event('visibilitychange')));
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: false
		});
		focused = true;
		act(() => window.dispatchEvent(new Event('focus')));
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: true
		});
	});

	it('keeps the embedded activity preview inactive when focus and visibility change', async () => {
		visibility = 'visible';
		renderSession(
			2,
			consultantUserData,
			`${conversationPath}?embeddedNotifications=1`
		);
		act(() => window.dispatchEvent(new Event('focus')));
		act(() => document.dispatchEvent(new Event('visibilitychange')));
		await act(async () => vi.advanceTimersByTime(10000));
		expect(apiPatchNotificationActiveView).not.toHaveBeenCalled();
	});

	it('releases suppression on unmount and ignores later focus, visibility and heartbeat callbacks', async () => {
		visibility = 'visible';
		const { unmount } = renderSession(
			2,
			consultantUserData,
			conversationPath
		);
		unmount();
		expect(apiPatchNotificationActiveView).toHaveBeenLastCalledWith({
			roomId: ROOM_ID,
			threadRootId: null,
			active: false
		});
		vi.mocked(apiPatchNotificationActiveView).mockClear();
		act(() => window.dispatchEvent(new Event('focus')));
		act(() => document.dispatchEvent(new Event('visibilitychange')));
		await act(async () => vi.advanceTimersByTime(10000));
		expect(apiPatchNotificationActiveView).not.toHaveBeenCalled();
	});

	it('does not suppress incoming notifications while the mounted Live Chat is hidden', async () => {
		renderSession(2, consultantUserData, conversationPath);
		await act(async () => vi.advanceTimersByTime(10000));
		expect(
			vi
				.mocked(apiPatchNotificationActiveView)
				.mock.calls.some(([request]) => request.active)
		).toBe(false);
	});
});

describe('legacy live-chat alias persistence', () => {
	beforeEach(() => {
		sessionStorage.clear();
		aliasPolicy.featureDisplayNameEditable = true;
		vi.clearAllMocks();
	});
	afterEach(cleanup);
	it('writes the visible alias to the session without patching login identity', async () => {
		renderSession(1);
		fireEvent.change(
			screen.getByRole('textbox', { name: 'profile.data.displayName' }),
			{ target: { value: 'Legacy session alias' } }
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'anonymousChat.pseudonym.continueWithSelection'
			})
		);
		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(SESSION_ID, {
				displayName: 'Legacy session alias'
			})
		);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});
	it('does not offer a dead confirm action for a blank custom alias', () => {
		renderSession(1);
		fireEvent.change(
			screen.getByRole('textbox', { name: 'profile.data.displayName' }),
			{ target: { value: '   ' } }
		);
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'anonymousChat.pseudonym.continueWithSelection'
			}).disabled
		).toBe(true);
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'anonymousChat.pseudonym.changeName'
			}).disabled
		).toBe(false);
	});
	it('ignores an older save after navigating A to B and back to a newer A save', async () => {
		let finishFirstA = () => {};
		let finishSecondA = () => {};
		vi.mocked(apiPutSessionData)
			.mockReturnValueOnce(
				new Promise<void>((resolve) => {
					finishFirstA = resolve;
				})
			)
			.mockResolvedValueOnce(undefined)
			.mockReturnValueOnce(
				new Promise<void>((resolve) => {
					finishSecondA = resolve;
				})
			);
		const view = renderSession(1);
		const saveAlias = (name: string) => {
			fireEvent.change(
				screen.getByRole('textbox', {
					name: 'profile.data.displayName'
				}),
				{ target: { value: name } }
			);
			fireEvent.click(
				screen.getByRole('button', {
					name: 'anonymousChat.pseudonym.continueWithSelection'
				})
			);
		};
		saveAlias('Older A alias');
		view.rerender(sessionElement(1, askerUserData, '/', SESSION_ID + 1));
		saveAlias('B alias');
		await waitFor(() =>
			expect(
				sessionStorage.getItem(
					'anonymous-pseudonym-' + (SESSION_ID + 1)
				)
			).toBe('1')
		);
		view.rerender(sessionElement(1));
		saveAlias('Newer A alias');
		expect(apiPutSessionData).toHaveBeenCalledTimes(3);
		reloadLegacySession.mockClear();
		await act(async () => {
			finishFirstA();
		});
		expect(reloadLegacySession).not.toHaveBeenCalled();
		expect(
			sessionStorage.getItem('anonymous-pseudonym-' + SESSION_ID)
		).toBeNull();
		expect(
			sessionStorage.getItem('anonymous-pseudonym-name-' + SESSION_ID)
		).toBeNull();
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'anonymousChat.pseudonym.continueWithSelection'
			}).disabled
		).toBe(true);
		await act(async () => {
			finishSecondA();
		});
		expect(
			sessionStorage.getItem('anonymous-pseudonym-name-' + SESSION_ID)
		).toBe('Newer A alias');
	});
	it('does not reload or mark an unmounted session after a delayed alias save', async () => {
		let finishSave = () => {};
		vi.mocked(apiPutSessionData).mockReturnValueOnce(
			new Promise<void>((resolve) => {
				finishSave = resolve;
			})
		);
		const view = renderSession(1);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'anonymousChat.pseudonym.continueWithSelection'
			})
		);
		view.unmount();
		await act(async () => {
			finishSave();
		});
		expect(reloadLegacySession).not.toHaveBeenCalled();
		expect(
			sessionStorage.getItem('anonymous-pseudonym-' + SESSION_ID)
		).toBeNull();
	});
});
