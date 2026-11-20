// @vitest-environment oriso-jsdom
/**
 * #1923: an asker must be able to leave a running group even when it has a
 * single moderator. Only a moderator needs a second one, so the group is never
 * left without anyone to run it.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	ConsultingTypesContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionMenu } from './SessionMenu';

const roomUsers = vi.hoisted(() => ({ moderators: [] as string[] }));

vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSessionTenantSettings', () => ({
	useSessionTenantSettings: () => ({ settings: {}, isLoading: false })
}));
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({ settings: {}, updateSettings: vi.fn() })
}));
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({ users: [], moderators: roomUsers.moderators })
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: {} })
}));

const groupSession = {
	isSession: false,
	isGroup: true,
	isEnquiry: false,
	rid: '!group:m.test',
	item: {
		id: 31,
		consultingType: 0,
		matrixRoomId: '!group:m.test',
		active: true,
		subscribed: true,
		moderators: ['counsellor'],
		groupId: 'group-31'
	}
};

const asker = {
	userId: 'asker',
	userName: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
};

const counsellor = {
	userId: 'counsellor',
	userName: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};

const renderMenu = (userData: object, bannedUsers: string[] = []) =>
	render(
		<MemoryRouter>
			<SessionTypeContext.Provider
				value={
					{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/user/view'
					} as any
				}
			>
				<UserDataContext.Provider value={{ userData } as any}>
					<ActiveSessionContext.Provider
						value={
							{
								activeSession: groupSession,
								reloadActiveSession: vi.fn()
							} as any
						}
					>
						<ConsultingTypesContext.Provider
							value={{ consultingTypes: [{ id: 0 }] } as any}
						>
							<SessionsDataContext.Provider
								value={{ dispatch: vi.fn() } as any}
							>
								<SessionMenu
									hasUserInitiatedStopOrLeaveRequest={{
										current: false
									}}
									isAskerInfoAvailable={false}
									bannedUsers={bannedUsers}
								/>
							</SessionsDataContext.Provider>
						</ConsultingTypesContext.Provider>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</SessionTypeContext.Provider>
		</MemoryRouter>
	);

const menuText = () => document.body.textContent ?? '';

beforeEach(() => {
	roomUsers.moderators = ['@counsellor:m.test'];
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {}
	})) as any;
});
afterEach(cleanup);

describe('SessionMenu leave group (#1923)', () => {
	it('offers leave to an asker in a group with one moderator', () => {
		renderMenu(asker);

		expect(menuText()).toContain('chatFlyout.leaveGroupChat');
	});

	it('does not offer leave to a banned asker', () => {
		renderMenu(asker, ['asker']);

		expect(menuText()).not.toContain('chatFlyout.leaveGroupChat');
	});

	it('keeps a sole moderator from leaving the group', () => {
		renderMenu(counsellor);

		expect(menuText()).not.toContain('chatFlyout.leaveGroupChat');
	});

	it('lets a counsellor leave when another moderator stays', () => {
		roomUsers.moderators = ['@counsellor:m.test', '@other:m.test'];
		renderMenu(counsellor);

		expect(menuText()).toContain('chatFlyout.leaveGroupChat');
	});
});
