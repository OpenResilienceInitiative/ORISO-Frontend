// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionHeaderComponent } from './SessionHeaderComponent';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import {
	mockActiveSession1on1,
	mockUserData
} from '../message/MessageItemComponent.mocks';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
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
		getContact: () => null,
		useConsultingType: () => null,
		useTopic: () => ({ name: 'Debt' }),
		REMOVE_SESSIONS: 'REMOVE_SESSIONS',
		NOTIFICATION_TYPE_SUCCESS: 'success',
		NOTIFICATION_TYPE_ERROR: 'error',
		NotificationsContext: ReactModule.createContext({
			addNotification: () => {},
			addEventNotification: () => {}
		}),
		SessionsDataContext: ReactModule.createContext(null),
		SessionTypeContext: ReactModule.createContext({}),
		UserDataContext: ReactModule.createContext(null),
		ActiveSessionContext: ReactModule.createContext(null)
	};
});

vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({ matrixClientService: undefined })
}));
vi.mock('../../hooks/useAppConfig', () => ({ useAppConfig: () => ({}) }));
vi.mock('../sessionMenu/SessionMenu', () => ({ SessionMenu: () => null }));
vi.mock('./ChatroomMainInteractionIcon', () => ({
	ChatroomMainInteractionIcon: () => null
}));

afterEach(cleanup);

describe('SessionHeaderComponent', () => {
	// #1845: a session without an agency id (0) rendered a stray "0" under the
	// advice seeker's header chips.
	it('renders no stray "0" for an advice seeker whose session has agencyId 0', () => {
		const activeSession = {
			isSession: true,
			item: {
				id: 4401,
				agencyId: 0,
				status: STATUS_ENQUIRY,
				consultingType: 1,
				topic: { id: 1 }
			}
		} as any;
		const userData = {
			userId: 'asker-1',
			grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
		} as any;

		render(
			<MemoryRouter>
				<UserDataContext.Provider value={{ userData } as any}>
					<ActiveSessionContext.Provider
						value={{ activeSession } as any}
					>
						<SessionHeaderComponent bannedUsers={[]} />
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</MemoryRouter>
		);

		expect(screen.getByText('Debt')).toBeTruthy();
		expect(screen.queryByText('0')).toBeNull();
	});
});

it('shows the active live-session alias instead of an account alias or stale local cache', () => {
	const session = mockActiveSession1on1();
	const userData = mockUserData({
		userId: 'asker-1',
		userName: 'unchanged_login_1234',
		displayName: 'Account alias from another session',
		grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
	});
	const renderSession = (id: number, displayName: string) => (
		<MemoryRouter>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				<ActiveSessionContext.Provider
					value={{
						activeSession: {
							...session,
							item: {
								...session.item,
								id,
								conversationType: 'LIVE_CHAT'
							},
							user: {
								...session.user,
								username: 'unchanged_login_1234',
								displayName
							}
						}
					}}
				>
					<SessionHeaderComponent bannedUsers={[]} />
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	sessionStorage.setItem(
		'anonymous-pseudonym-name-3363',
		'Stale cached alias'
	);
	try {
		const view = render(renderSession(3363, 'First session alias'));
		expect(
			screen.getByRole('heading', { name: 'First session alias' })
		).toBeTruthy();
		view.rerender(renderSession(3364, 'Second session alias'));
		expect(
			screen.getByRole('heading', { name: 'Second session alias' })
		).toBeTruthy();
		expect(screen.queryByText('First session alias')).toBeNull();
		expect(
			screen.queryByText('Account alias from another session')
		).toBeNull();
		view.rerender(renderSession(3365, ' '));
		expect(
			screen.getByRole('heading', { name: 'unchanged_login_1234' })
		).toBeTruthy();
		sessionStorage.setItem('anonymous-pseudonym-name-3365', 'anon_chosen');
		view.rerender(renderSession(3365, ''));
		expect(
			screen.getByRole('heading', { name: 'anon_chosen' })
		).toBeTruthy();
	} finally {
		sessionStorage.removeItem('anonymous-pseudonym-name-3363');
		sessionStorage.removeItem('anonymous-pseudonym-name-3365');
	}
});
