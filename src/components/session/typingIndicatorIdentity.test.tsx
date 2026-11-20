// @vitest-environment oriso-jsdom
/**
 * #2387: the typing indicator names and draws the advice seeker the way their
 * messages do. Matrix only knows the login, so the session's alias wins, and
 * the animal comes from the real Matrix user id.
 */
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionItemComponent, TypingUser } from './SessionItemComponent';
import { UserAvatar } from '../message/UserAvatar';
import {
	ActiveSessionContext,
	NotificationsContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';

const ROOM_ID = '!session:matrix.example.org';
const ASKER_ID = '@enc.mfxg63s7gi3q:matrix.example.org';
const COUNSELLOR_ID = '@counsellor1:matrix.example.org';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' }
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
		getContact: (session: any) => session?.user ?? null,
		useTenant: () => ({}),
		useConsultingType: () => null,
		NOTIFICATION_TYPE_INFO: 'INFO',
		NotificationsContext: ReactModule.createContext({
			addEventNotification: () => {}
		}),
		UserDataContext: ReactModule.createContext(null),
		SessionTypeContext: ReactModule.createContext(null),
		ActiveSessionContext: ReactModule.createContext(null),
		LocaleContext: ReactModule.createContext({ locale: 'en' })
	};
});

vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: undefined })
}));
vi.mock('../../globalState/provider/LegalLinksProvider', async () => {
	const ReactModule = await import('react');
	return { LegalLinksContext: ReactModule.createContext([]) };
});

vi.mock('../messageSubmitInterface/messageSubmitInterfaceComponent', () => ({
	MessageSubmitInterfaceComponent: () => null
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

const activeSession = {
	rid: ROOM_ID,
	isGroup: false,
	isSession: true,
	// The seeker renamed this conversation; the login stays the pseudonym.
	user: { username: 'kaefer_toni_8086', displayName: 'Harbour Lights' },
	consultant: { id: 'counsellor-1', username: 'counsellor1' },
	item: {
		id: 200,
		matrixRoomId: ROOM_ID,
		askerMatrixUserId: ASKER_ID,
		consultantMatrixUserId: COUNSELLOR_ID,
		status: 2,
		active: true
	}
} as any;

const renderTyping = (typingUsers: TypingUser[]) =>
	render(
		<MemoryRouter>
			<NotificationsContext.Provider
				value={{ addEventNotification: vi.fn() } as any}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'counsellor-1',
								userName: 'counsellor1',
								grantedAuthorities: [
									'AUTHORIZATION_CONSULTANT_DEFAULT'
								],
								userRoles: ['CONSULTANT']
							},
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
								typingUsers={typingUsers}
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

const indicator = (container: HTMLElement) =>
	container.querySelector('.session__inlineTypingIndicator');

describe('typing indicator identity (#2387)', () => {
	afterEach(cleanup);

	it('names the advice seeker by the session alias and draws their own animal', () => {
		const { container } = renderTyping([
			{ userId: ASKER_ID, name: 'kaefer_toni_8086' }
		]);

		expect(
			indicator(container)?.querySelector('.session__inlineTypingLabel')
				?.textContent
		).toBe('Harbour Lights typingIndicator.singleUser.typing');

		const avatar = indicator(container)?.querySelector(
			'[data-testid="user-avatar"]'
		);
		expect(avatar?.getAttribute('aria-label')).toBe('Harbour Lights');
		// The animal is derived from the Matrix user id, as on the messages.
		const reference = render(
			<UserAvatar
				username="Harbour Lights"
				displayName="Harbour Lights"
				userId={ASKER_ID}
				ring={false}
			/>
		).container.querySelector('[data-testid="user-avatar"]');
		expect(avatar?.innerHTML).toBe(reference?.innerHTML);
	});

	it('keeps the Matrix name of anyone else in the room', () => {
		const { container } = renderTyping([
			{ userId: COUNSELLOR_ID, name: 'Counsellor One' }
		]);

		expect(
			indicator(container)?.querySelector('.session__inlineTypingLabel')
				?.textContent
		).toBe('Counsellor One typingIndicator.singleUser.typing');
	});
});
