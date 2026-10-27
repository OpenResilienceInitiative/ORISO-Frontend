// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionHeaderComponent } from './SessionHeaderComponent';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
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
