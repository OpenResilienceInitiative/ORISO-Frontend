// @vitest-environment oriso-jsdom
/**
 * FE#2330 / US#1601 — a Live Chat guest who converted to a lasting account
 * signs in again with an empty sessionStorage. The guest gates (name choice,
 * waiting room) used to come back, hid the history — for good once the chat
 * was finished — and stored a new random display name. A lasting account
 * skips them; a guest still gets them.
 */
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiPutSessionData } from '../../api/apiPutSessionData';
import { SessionItemComponent } from './SessionItemComponent';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import {
	ensureAnonymousChatPreLogoutCleanup,
	finishPendingAnonymousChatSession
} from '../../utils/anonymousChatSessionCleanup';
import { apiFinishAnonymousConversation } from '../../api/apiFinishAnonymousConversation';

const SESSION_ID = 112;
const ROOM_ID = '!live-chat:matrix.example.org';
const conversion = vi.hoisted(() => ({ state: 'PROMOTED' }));
vi.mock('../liveChatConversion/liveChatConversionApi', () => ({
	getConversionStatus: async () => ({
		userId: 'asker-1',
		username: 'anon_17',
		state: conversion.state,
		intentId: 'intent-1',
		finishedOrigin: false
	})
}));
vi.mock('../../api/apiFinishAnonymousConversation', () => ({
	apiFinishAnonymousConversation: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn(() => new Promise(() => undefined))
}));
vi.mock('../sessionCookie/getMatrixAccessToken', () => ({
	getCurrentAuthSubject: () => 'asker-1'
}));
vi.mock('../profile/EncryptionSettings/RecoveryKeySaveStep', () => ({
	RecoveryKeySaveStep: ({ onConfirm }: { onConfirm: () => void }) => (
		<button onClick={onConfirm}>Confirm saved key</button>
	)
}));
vi.mock('../profile/NewRequestDialog/NewRequestDialog', () => ({
	NewRequestDialog: () => null
}));

// FE#2251: the conversion page now prefills the request dialog from the
// asker's sessions and the app config. This test covers the closed-chat
// dialog, not the prefill, so the hook is stubbed instead of widening the
// hand-rolled globalState mock below.
vi.mock('../furtherCounselling/useFurtherCounsellingPrefill', () => ({
	useFurtherCounsellingPrefill: () => ({
		prefilledPostcode: undefined,
		knownAgencyIds: []
	})
}));

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
		useTenant: () => ({}),
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
	useMatrixClient: () => ({
		matrixClientService: undefined
	})
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

vi.mock('../pseudonym/PseudonymCard', () => ({
	PseudonymCard: () => <div data-testid="pseudonym-card" />
}));
vi.mock('../pseudonym/PrivacyMessageCard', () => ({
	PrivacyMessageCard: () => <div data-testid="privacy-card" />
}));
vi.mock('../pseudonym/PseudonymActionBar', () => ({
	PseudonymActionBar: () => <div data-testid="pseudonym-action-bar" />
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
	MessageSubmitInterfaceComponent: () => <div data-testid="composer" />
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
	userName: 'anon_17',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	userRoles: ['USER'],
	dataPrivacyConfirmation: '2026-11-18T12:41:00Z'
} as any;

const renderSession = (status: number) =>
	render(
		<MemoryRouter>
			<NotificationsContext.Provider
				value={{ addEventNotification: vi.fn() } as any}
			>
				<UserDataContext.Provider
					value={
						{ userData: askerUserData, setUserData: vi.fn() } as any
					}
				>
					<SessionTypeContext.Provider
						value={{ type: SESSION_LIST_TYPES.MY_SESSION } as any}
					>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession: {
										rid: ROOM_ID,
										isGroup: false,
										isSession: true,
										user: {
											username: 'anon_17',
											displayName: 'giraffe_tarin_7559'
										},
										consultant: {
											id: 'consultant-1',
											username: 'Beraterin'
										},
										item: {
											id: SESSION_ID,
											matrixRoomId: ROOM_ID,
											conversationType: 'LIVE_CHAT',
											status,
											active: true,
											askerMatrixUserId:
												'@anon_17:matrix.example.org'
										}
									},
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

const settle = () =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});
const history = () => document.querySelector('.message-holder');

describe('SessionItemComponent — a converted Live Chat account (FE#2330)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		/* A fresh sign-in: nothing of the guest's tab survived. */
		sessionStorage.clear();
		localStorage.setItem('matrix_session_subject', 'asker-1');
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it.each([
		['an active', 2],
		['a finished', 3]
	])(
		'shows the history of %s chat without the guest gates',
		async (_label, status) => {
			conversion.state = 'PROMOTED';
			renderSession(status);
			await settle();

			expect(screen.queryByTestId('pseudonym-action-bar')).toBeNull();
			expect(screen.queryByTestId('consultant-accepted-bar')).toBeNull();
			expect(history()).not.toBeNull();
			expect(apiPutSessionData).not.toHaveBeenCalled();
		}
	);

	/* With the gates gone, nothing else stopped a finished Live Chat from
	   offering the composer; the way on is a written request. */
	it('closes a finished chat for writing and offers mail counselling', async () => {
		conversion.state = 'PROMOTED';
		renderSession(3);
		await settle();

		expect(history()).not.toBeNull();
		expect(screen.queryByTestId('composer')).toBeNull();
		expect(screen.getByText('anonymousChat.enquiryClosed')).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'anonymousChat.noAvailability.startMailCounseling'
			})
		).toBeTruthy();
	});

	it('keeps the composer of an active chat', async () => {
		conversion.state = 'PROMOTED';
		renderSession(2);
		await settle();

		expect(screen.getByTestId('composer')).toBeTruthy();
	});

	it('keeps the chat open when the converted account signs out', async () => {
		conversion.state = 'PROMOTED';
		ensureAnonymousChatPreLogoutCleanup();
		renderSession(2);
		await settle();

		await act(async () => {
			await finishPendingAnonymousChatSession();
		});

		expect(apiFinishAnonymousConversation).not.toHaveBeenCalled();
	});

	it('still asks a guest to choose a name first', async () => {
		conversion.state = 'ELIGIBLE';
		renderSession(2);
		await settle();

		expect(screen.getByTestId('pseudonym-action-bar')).toBeTruthy();
		expect(history()).toBeNull();
	});
});
