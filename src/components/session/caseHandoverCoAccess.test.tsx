// @vitest-environment jsdom
/**
 * #200: an "advice needed" handover grants CO_ACCESS — the colleague may read
 * the case but must never write into the advice seeker's room. The composer
 * is withheld and a read-only notice takes its place; owners and TAKEOVER
 * recipients keep writing as before.
 */
import React from 'react';
import { render, screen, cleanup, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionItemComponent } from './SessionItemComponent';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import type { CaseHandoverStatus } from '../../api/apiCaseHandover';

configure({ testIdAttribute: 'data-cy' });

const SESSION_ID = 194;
const ROOM_ID = '!session:matrix.example.org';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { until?: string }) =>
			options?.until ? `${key} ${options.until}` : key,
		i18n: { language: 'de' }
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
		getContact: () => ({ username: 'Ratsuchende' }),
		useTenant: () => ({}),
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

/* Children that would drag in TipTap, MUI dialogs or the Matrix SDK. The
   composer is the subject of the assertions, so it gets a testid. */
vi.mock('../messageSubmitInterface/messageSubmitInterfaceComponent', () => ({
	MessageSubmitInterfaceComponent: () => <div data-cy="composer" />
}));
vi.mock('../messageSubmitInterface/MessageSubmitErrorBoundary', () => ({
	MessageSubmitErrorBoundary: ({ children }: any) => <>{children}</>
}));
vi.mock('../messageSubmitInterface/messageSubmitInterfaceSkeleton', () => ({
	MessageSubmitInterfaceSkeleton: () => null
}));
vi.mock('../sessionHeader/SessionHeaderComponent', () => ({
	SessionHeaderComponent: () => null
}));
vi.mock('./EncryptionBanner', () => ({ EncryptionBanner: () => null }));
vi.mock('./ThreadListPanel', () => ({ ThreadListPanel: () => null }));
vi.mock('./AcceptAssign', () => ({ AcceptAssign: () => null }));
vi.mock('../message/MessageItemComponent', () => ({
	MessageItemComponent: () => null
}));
vi.mock('../dragAndDropArea/DragAndDropArea', () => ({
	DragAndDropArea: () => null
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
vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn(() => Promise.resolve()),
	TError: {}
}));

const counsellorUserData = {
	userId: 'counsellor-2',
	userName: 'counsellor2',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	userRoles: ['CONSULTANT']
} as any;

const activeSession = {
	rid: ROOM_ID,
	isGroup: false,
	isSession: true,
	user: { username: 'seeker' },
	consultant: { id: 'counsellor-1', username: 'counsellor1' },
	item: {
		id: SESSION_ID,
		matrixRoomId: ROOM_ID,
		status: 2,
		active: true
	}
} as any;

const EXPIRES_AT = '2026-09-25T07:36:21';

const grant = (
	accessType: 'CO_ACCESS' | 'TAKEOVER',
	status = 'GRANTED'
): CaseHandoverStatus => ({
	sessionId: SESSION_ID,
	requestId: 38,
	status,
	canViewContent: true,
	clientConsentRequired: false,
	accessType,
	...(accessType === 'CO_ACCESS' && { expiresAt: EXPIRES_AT })
});

const renderSession = (caseHandoverStatus: CaseHandoverStatus | null) =>
	render(
		<MemoryRouter>
			<NotificationsContext.Provider
				value={{ addEventNotification: vi.fn() } as any}
			>
				<UserDataContext.Provider
					value={
						{
							userData: counsellorUserData,
							setUserData: vi.fn()
						} as any
					}
				>
					<SessionTypeContext.Provider
						value={{ type: SESSION_LIST_TYPES.MY_SESSION } as any}
					>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession,
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
								caseHandoverStatus={caseHandoverStatus}
							/>
						</ActiveSessionContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);

describe('SessionItemComponent — case handover co-access is read-only', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it.each(['GRANTED', 'GRANTED_PENDING_CLIENT_OPTOUT'])(
		'withholds the composer and shows until when for a %s co-access viewer',
		async (status) => {
			renderSession(grant('CO_ACCESS', status));

			const notice = await screen.findByTestId(
				'case-handover-read-only-notice'
			);
			// Server time is naive UTC; the notice shows the viewer's local time.
			const localUntil = new Date(`${EXPIRES_AT}Z`).toLocaleString('de', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
			expect(notice.textContent).toContain(localUntil);
			expect(screen.queryByTestId('composer')).toBeNull();
		}
	);

	it('keeps the composer for the case owner', async () => {
		renderSession(null);

		expect(await screen.findByTestId('composer')).toBeTruthy();
		expect(
			screen.queryByTestId('case-handover-read-only-notice')
		).toBeNull();
	});

	it('keeps the composer for a TAKEOVER recipient', async () => {
		renderSession(grant('TAKEOVER'));

		expect(await screen.findByTestId('composer')).toBeTruthy();
		expect(
			screen.queryByTestId('case-handover-read-only-notice')
		).toBeNull();
	});
});
