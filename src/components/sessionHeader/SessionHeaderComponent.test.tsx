// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { SessionHeaderComponent } from './SessionHeaderComponent';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockUserData
} from '../message/MessageItemComponent.mocks';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

const { matrixClient } = vi.hoisted(() => ({ matrixClient: vi.fn() }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'consultant.assignedLabel' ? 'Ihre Beratungsperson' : key
	})
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		AUTHORITIES: {
			ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT',
			ANONYMOUS_DEFAULT: 'AUTHORIZATION_ANONYMOUS_DEFAULT',
			CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT'
		},
		hasUserAuthority: (authority: string, userData: any) =>
			Boolean(userData?.grantedAuthorities?.includes(authority)),
		getContact: (session: ReturnType<typeof mockActiveSession1on1>) =>
			session.user ?? session.consultant ?? null,
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
	useMatrixClient: () => ({ matrixClientService: matrixClient() })
}));
vi.mock('../../hooks/useAppConfig', () => ({ useAppConfig: () => ({}) }));
vi.mock('../sessionMenu/SessionMenu', () => ({ SessionMenu: () => null }));
vi.mock('./ChatroomMainInteractionIcon', () => ({
	ChatroomMainInteractionIcon: () => null
}));

afterEach(() => {
	cleanup();
	matrixClient.mockReset();
});

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

describe('registered asker public counsellor identity', () => {
	const login = 'counsellor_at_qa.invalid';
	const consultantMatrixId = `@${login}:qa.invalid`;
	const legacyName = 'matrix-counsellor@qa.invalid';
	const assignedLabel = 'Ihre Beratungsperson';
	const assignedAvatar = (name: string) =>
		screen
			.getAllByRole('img', { name })
			.find((element) => element.dataset.userId === consultantMatrixId);
	const userData = mockUserData({
		userId: 'asker-1',
		grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
	});
	const renderSession = (
		activeSession: ReturnType<typeof mockActiveSession1on1>
	) =>
		render(
			<MemoryRouter>
				<UserDataContext.Provider
					value={{
						userData,
						setUserData: () => {},
						reloadUserData: async () => userData
					}}
				>
					<ActiveSessionContext.Provider value={{ activeSession }}>
						<SessionHeaderComponent bannedUsers={[]} />
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</MemoryRouter>
		);
	const session = (displayName?: string, username = login) => {
		const base = mockActiveSession1on1();
		if (!base.item || !base.consultant) {
			throw new Error('Expected an assigned counselling fixture');
		}
		return {
			...base,
			user: undefined,
			item: {
				...base.item,
				consultantMatrixUserId: consultantMatrixId
			},
			consultant: { ...base.consultant, username, displayName }
		};
	};

	it.each([
		{ connected: false, internalMarker: false },
		{ connected: true, internalMarker: false },
		{ connected: true, internalMarker: true }
	])(
		'uses a safe title and avatar name (Matrix: $connected, internal marker: $internalMarker)',
		({ connected, internalMarker }) => {
			if (connected) {
				matrixClient.mockReturnValue({
					getClient: () => ({
						getUserId: () => MOCK_ASKER_MATRIX_ID,
						getRoom: () => ({
							getJoinedMembers: () => [
								{
									userId: consultantMatrixId,
									name: legacyName
								},
								{
									userId: MOCK_ASKER_MATRIX_ID,
									name: 'Asker alias'
								}
							]
						})
					})
				});
			}
			const activeSession = session();
			if (internalMarker) {
				activeSession.item.supervision = {
					supervisedByMe: false,
					supervisorConsultantIds: [],
					supervisorDisplayNames: [],
					counsellorDisplayName: 'Private staff label'
				};
			}
			renderSession(activeSession);

			const avatar = assignedAvatar(assignedLabel);
			expect(avatar).toBeDefined();
			if (!avatar)
				throw new Error('Assigned counsellor avatar is missing');
			expect(
				screen.getByRole('heading', { name: assignedLabel })
			).toBeTruthy();
			expect(avatar.getAttribute('data-user-id')).toBe(
				consultantMatrixId
			);
			fireEvent.focus(avatar);
			expect(screen.getByRole('tooltip').textContent).toBe(assignedLabel);
			expect(screen.queryByRole('img', { name: legacyName })).toBeNull();
			expect(screen.queryByText(login)).toBeNull();
			expect(screen.queryByText('Private staff label')).toBeNull();
			if (connected) {
				expect(
					screen
						.getAllByRole('img', { name: 'Asker alias' })
						.some(
							(element) =>
								element.dataset.userId === MOCK_ASKER_MATRIX_ID
						)
				).toBe(true);
			}
		}
	);

	it.each([
		['Nora P.', login, 'Nora P.'],
		[undefined, 'nora-p', 'nora-p'],
		['counsellor@qa.invalid', 'nora-p', 'nora-p']
	])(
		'preserves a public name or chosen pseudonym (%s)',
		(displayName, username, expected) => {
			renderSession(session(displayName, username));

			expect(
				screen.getByRole('heading', { name: expected })
			).toBeTruthy();
			expect(assignedAvatar(expected)).toBeDefined();
		}
	);

	it('keeps the enquiry-phase label when no counsellor is assigned', () => {
		const enquiry = session();
		renderSession({
			...enquiry,
			consultant: undefined,
			item: {
				...enquiry.item,
				status: STATUS_ENQUIRY,
				consultantMatrixUserId: undefined
			}
		});

		expect(
			screen.getByRole('heading', {
				name: 'sessionList.user.consultantUnknown'
			})
		).toBeTruthy();
	});
});
