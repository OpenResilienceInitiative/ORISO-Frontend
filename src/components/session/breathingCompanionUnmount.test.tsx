// @vitest-environment jsdom
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
	fireEvent
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionItemComponent } from './SessionItemComponent';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';

const SESSION_ID = 4711;
const ROOM_ID = '!live-chat:matrix.oriso.org';

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

const buildActiveSession = (status: number) =>
	({
		rid: ROOM_ID,
		isGroup: false,
		isSession: true,
		user: { username: 'anon_7' },
		consultant: { id: 'consultant-1', username: 'Beraterin' },
		item: {
			id: SESSION_ID,
			matrixRoomId: ROOM_ID,
			conversationType: 'LIVE_CHAT',
			status,
			active: true,
			askerMatrixUserId: '@anon_7:matrix.oriso.org'
		}
	}) as any;

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
									activeSession: buildActiveSession(status),
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
