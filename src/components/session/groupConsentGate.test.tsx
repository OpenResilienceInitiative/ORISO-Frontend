// @vitest-environment jsdom
/**
 * ADR-022 gate 2 in a self-help group (#1499): a client whose agreement to the
 * group's Beratungsstelle privacy statement is not recorded sees the gate
 * before the first message, and nobody else does.
 */
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
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
const ROOM_ID = '!group:matrix.oriso.org';

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
	MessageSubmitInterfaceComponent: () => <div data-testid="composer" />
}));

vi.mock('../groupChat/consent/GroupConsentGate', () => ({
	GroupConsentGate: ({ agencyId }: { agencyId?: number }) => (
		<div data-testid="group-consent-gate" data-agency={String(agencyId)} />
	)
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

const client = (dataPrivacyConfirmation: string | null) =>
	({
		userId: 'asker-1',
		userName: 'ente_yuki_7984',
		grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
		userRoles: ['USER'],
		dataPrivacyConfirmation
	}) as any;

const counsellor = {
	userId: 'consultant-1',
	userName: 'beraterin',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	userRoles: ['CONSULTANT'],
	dataPrivacyConfirmation: null
} as any;

const groupSession = {
	rid: ROOM_ID,
	isGroup: true,
	isSession: false,
	item: {
		id: SESSION_ID,
		matrixRoomId: ROOM_ID,
		conversationType: 'SELF_HELP',
		active: true,
		subscribed: true,
		assignedAgencies: [{ id: 19, name: 'Beratungstelle' }]
	}
} as any;

const renderGroup = (userData: any) =>
	render(
		<MemoryRouter>
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
									activeSession: groupSession,
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

describe('SessionItemComponent — privacy gate in a self-help group', () => {
	beforeEach(() => sessionStorage.clear());

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('asks a client without a recorded agreement before the first message', async () => {
		renderGroup(client(null));

		const gate = await screen.findByTestId('group-consent-gate');
		expect(gate.dataset.agency).toBe('19');
		expect(screen.queryByTestId('composer')).toBeNull();
	});

	it('lets a client whose agreement is recorded write straight away', async () => {
		renderGroup(client('2026-09-23T10:00:00Z'));

		expect(await screen.findByTestId('composer')).toBeTruthy();
		expect(screen.queryByTestId('group-consent-gate')).toBeNull();
	});

	it('never asks the counsellor', async () => {
		renderGroup(counsellor);

		await act(async () => undefined);
		expect(screen.queryByTestId('group-consent-gate')).toBeNull();
	});
});
