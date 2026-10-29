// @vitest-environment jsdom
/**
 * #1499: on a phone the waiting room and the join view show the session menu.
 * A counsellor who has not joined the running group yet must not be offered
 * to leave or stop it from there.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
// Two moderators, so leaving would be allowed in a running group.
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({
		users: [],
		moderators: ['@counsellor:m.test', '@other:m.test']
	})
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
		id: 19,
		consultingType: 0,
		matrixRoomId: '!group:m.test',
		active: true,
		subscribed: true,
		moderators: ['counsellor'],
		groupId: 'group-19'
	}
};

const counsellor = {
	userId: 'counsellor',
	userName: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};

const renderMenu = (isJoinGroupChatView: boolean) =>
	render(
		<MemoryRouter>
			<SessionTypeContext.Provider
				value={
					{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					} as any
				}
			>
				<UserDataContext.Provider
					value={{ userData: counsellor } as any}
				>
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
									isJoinGroupChatView={isJoinGroupChatView}
									bannedUsers={[]}
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

describe('SessionMenu group actions in the join view (#1499)', () => {
	it('offers leave and stop to a moderator inside the running group', () => {
		renderMenu(false);

		expect(menuText()).toContain('chatFlyout.leaveGroupChat');
		expect(menuText()).toContain('chatFlyout.stopGroupChat');
	});

	it('offers neither while the counsellor has not joined the group yet', () => {
		renderMenu(true);

		expect(menuText()).not.toContain('chatFlyout.leaveGroupChat');
		expect(menuText()).not.toContain('chatFlyout.stopGroupChat');
	});
});
