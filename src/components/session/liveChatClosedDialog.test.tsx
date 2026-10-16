// @vitest-environment jsdom
/**
 * #1270 — the legacy "Live-Chat ist zurzeit leider geschlossen" dialog in
 * `SessionItemComponent`.
 *
 * It used to open on a single zero poll (the details endpoint reports its own
 * failed availability lookup as zero, so one zero proves nothing) and it closed
 * on a click beside it or Esc, which let the asker walk past a state that
 * says nobody can answer. These tests pin: two consecutive zeros open it, a
 * backdrop click or Esc does not close it, only its buttons do, and a counsellor
 * coming online closes it by itself.
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
import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';
import { SessionItemComponent } from './SessionItemComponent';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';

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
	apiGetAnonymousEnquiryDetails: vi.fn()
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
			askerMatrixUserId: '@anon_7:matrix.example.org'
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

const poll = (numAvailableConsultants: number) =>
	({
		peopleAhead: 1,
		numAvailableConsultants,
		status: 'ENQUIRY'
	}) as never;
const tick = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
const dialog = () => screen.queryByRole('dialog');
const NO_AVAILABILITY = 'anonymousChat.noAvailability';

describe('SessionItemComponent — the "live chat is closed" dialog (#1270)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		sessionStorage.clear();
		sessionStorage.setItem(`anonymous-inquiry-consent-${SESSION_ID}`, '1');
		sessionStorage.setItem(`anonymous-pseudonym-${SESSION_ID}`, '1');
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	/* The endpoint reports its own failed availability lookup as zero. */
	it('does not open on a single zero poll', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails)
			.mockResolvedValueOnce(poll(0))
			.mockResolvedValue(poll(1));
		renderSession(1);
		await tick(0);
		expect(dialog()).toBeNull();

		await tick(4000);
		expect(dialog()).toBeNull();
	});

	it('opens once nobody is live twice in a row', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(0);
		expect(dialog()).toBeNull();

		await tick(4000);
		expect(dialog()).not.toBeNull();
		expect(
			screen.getByText(`${NO_AVAILABILITY}.title`, { exact: false })
		).toBeTruthy();
		/* It cannot be waved away any more, so a screen reader must at least
		   hear what it is. */
		expect(
			screen.getByRole('dialog', { name: `${NO_AVAILABILITY}.title` })
		).toBeTruthy();
	});

	it('does not let a failed poll between two zeros stand in for the second look', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails)
			.mockResolvedValueOnce(poll(0))
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValue(poll(0));
		renderSession(1);
		await tick(0);
		await tick(4000);
		expect(dialog()).toBeNull();

		await tick(4000);
		expect(dialog()).not.toBeNull();
	});

	/* `fetchData` allows 30 s per request against a 4 s interval, so polls overlap
	   and may complete out of order. The dialog cannot be waved away any more, so
	   an old answer arriving late must not count towards opening it. */
	it('ignores a slow, older poll that answers after a newer one', async () => {
		let answerSlowPoll: (value: never) => void = () => {};
		vi.mocked(apiGetAnonymousEnquiryDetails)
			.mockResolvedValueOnce(poll(0)) // t=0   first look: nobody
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						answerSlowPoll = resolve as (value: never) => void;
					}) // t=4s  slow, still in flight
			)
			.mockResolvedValueOnce(poll(1)) // t=8s  somebody is live
			.mockResolvedValue(poll(0)); // t=12s nobody again
		renderSession(1);
		await tick(0);
		await tick(4000);
		await tick(4000);

		/* The 4 s poll finally answers "nobody" — older than the "somebody"
		   that already arrived. */
		await act(async () => {
			answerSlowPoll(poll(0));
		});
		await tick(4000);

		/* In real order the zeros were 0, 0, 1, 0: one zero in a row. */
		expect(dialog()).toBeNull();
	});

	it('stays open on a click beside it and on Esc', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(4000);
		expect(dialog()).not.toBeNull();

		const backdrop = document.querySelector('.MuiBackdrop-root');
		expect(backdrop).not.toBeNull();
		await act(async () => {
			fireEvent.click(backdrop as Element);
		});
		await act(async () => {
			fireEvent.keyDown(dialog() as Element, {
				key: 'Escape',
				code: 'Escape'
			});
		});
		await tick(1000);

		expect(dialog()).not.toBeNull();
	});

	it('still closes on its own explicit "come back later" button', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(4000);
		expect(dialog()).not.toBeNull();

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: `${NO_AVAILABILITY}.later`
				})
			);
		});
		await tick(1000);

		expect(dialog()).toBeNull();
	});

	/* Dismissing must not leave the asker in a queue that looks normal. */
	it('says that nobody is live, without blocking, after "come back later"', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(4000);
		expect(
			screen.queryByText(`${NO_AVAILABILITY}.laterNotice`)
		).toBeNull();

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: `${NO_AVAILABILITY}.later`
				})
			);
		});
		await tick(1000);

		expect(dialog()).toBeNull();
		const notice = screen.getByText(`${NO_AVAILABILITY}.laterNotice`);
		expect(notice.closest('[role="status"]')).not.toBeNull();
	});

	it('drops that notice when somebody is live again', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(4000);
		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', {
					name: `${NO_AVAILABILITY}.later`
				})
			);
		});
		expect(
			screen.queryByText(`${NO_AVAILABILITY}.laterNotice`)
		).not.toBeNull();

		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(1));
		await tick(4000);
		await tick(1000);

		expect(
			screen.queryByText(`${NO_AVAILABILITY}.laterNotice`)
		).toBeNull();
	});

	it('closes by itself when somebody is live again', async () => {
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(0));
		renderSession(1);
		await tick(4000);
		expect(dialog()).not.toBeNull();

		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue(poll(1));
		await tick(4000);
		await tick(1000);

		expect(dialog()).toBeNull();
	});
});
