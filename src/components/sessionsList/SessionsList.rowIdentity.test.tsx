// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import {
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { ListItemInterface, STATUS_ACTIVE } from '../../globalState/interfaces';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionsList } from './SessionsList';

const getList = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetConsultantSessionList: getList,
	apiGetCaseHandoverCandidates: async () => ({ sessions: [], total: 0 })
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: async () => ({ sessions: [] })
}));
vi.mock('../../api/apiUserDrafts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiUserDrafts')>()),
	apiGetUserDrafts: async () => ({ items: [], page: 0, perPage: 200 })
}));
vi.mock('../../api/apiSetLiveChatAvailability', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../api/apiSetLiveChatAvailability')
	>()),
	apiGetLiveChatAvailability: async () => false
}));
vi.mock('../../globalState', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../globalState')>()),
	useTenant: () => ({}),
	useConsultingType: () => ({ registration: { autoSelectPostcode: false } }),
	useTopic: () => null
}));
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ key: null, keyID: null, encrypted: false, ready: true })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const consultant = {
	id: 'counsellor-1',
	consultantId: 'counsellor-1',
	username: 'counsellor',
	displayName: 'Counsellor',
	absent: false,
	absenceMessage: ''
};
const makeCase = (
	id: number,
	username: string,
	messageDate: number
): ListItemInterface => ({
	consultant,
	user: { username, displayName: username, sessionData: {} },
	agency: { id: 9, name: 'Test agency' } as any,
	session: {
		id,
		conversationType: 'AGENCY_COUNSELLING',
		agencyId: 9,
		askerMatrixUserId: `@${username}:example.test`,
		consultingType: 1,
		matrixRoomId: `!case${id}:example.test`,
		status: STATUS_ACTIVE,
		messageDate,
		createDate: '2026-10-08T10:00:00Z',
		messagesRead: true,
		registrationType: 'REGISTERED',
		postcode: 12345,
		lastMessage: 'Test message',
		e2eLastMessage: null,
		attachment: null,
		videoCallMessageDTO: null,
		topic: { id: 3, name: 'Test topic', description: '' }
	}
});
const internalGroup: ListItemInterface = {
	consultant,
	agency: { id: 9, name: 'Test agency' } as any,
	chat: {
		id: 41,
		conversationType: 'INTERNAL_GROUP',
		matrixRoomId: '!internal41:example.test',
		topic: 'QA internal group',
		messageDate: 3,
		createdAt: '2026-10-08T10:00:00Z',
		active: true,
		subscribed: true,
		assignedAgencies: [],
		attachment: null,
		consultingType: 1,
		duration: 60,
		hintMessage: '',
		lastMessage: 'Test message',
		e2eLastMessage: null,
		messagesRead: true,
		moderators: [],
		repetitive: false,
		startDate: '2026-10-08',
		startTime: '10:00'
	}
};

it('removes an internal group when search has no results after filtering colliding case and chat IDs', async () => {
	// A numeric case ID and a numeric group-chat ID belong to different namespaces.
	const sessions = [
		internalGroup,
		makeCase(41, 'First client', 2),
		makeCase(42, 'Second client', 1)
	];
	getList.mockResolvedValue({ sessions, total: sessions.length });
	const view = render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'counsellor-1',
							userName: 'counsellor',
							userRoles: ['consultant'],
							grantedAuthorities: [
								'AUTHORIZATION_CONSULTANT_DEFAULT'
							],
							agencies: []
						}
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<SessionsDataContext.Provider
						value={{ sessions, dispatch: vi.fn(), ready: true }}
					>
						<E2EEContext.Provider
							value={{
								key: null,
								reloadPrivateKey: () => {},
								isE2eeEnabled: false,
								e2EEReady: true
							}}
						>
							<LegalLinksContext.Provider value={[]}>
								<SessionsList
									defaultLanguage="de"
									sessionTypes={[] as any}
								/>
							</LegalLinksContext.Provider>
						</E2EEContext.Provider>
					</SessionsDataContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	await waitFor(() =>
		expect(view.container.querySelector('.skeleton')).toBeNull()
	);
	expect(screen.getByText('QA internal group')).toBeTruthy();
	expect(screen.getByText('First client')).toBeTruthy();
	expect(screen.getByText('Second client')).toBeTruthy();
	const search = screen.getByRole('searchbox');
	const list = view.container.querySelector<HTMLDivElement>(
		'.sessionsList__scrollContainer'
	)!;
	fireEvent.change(search, { target: { value: 'Second client' } });
	await waitFor(() => expect(screen.queryByText('First client')).toBeNull());
	expect(within(list).getByText('Second client')).toBeTruthy();
	expect(
		screen.queryByText('sessionList.toolbar.emptyFilterResult')
	).toBeNull();
	expect(list.querySelectorAll('.sessionsListItem')).toHaveLength(1);
	fireEvent.change(search, {
		target: { value: 'does not match any conversation' }
	});
	await screen.findByText('sessionList.toolbar.emptyFilterResult');
	expect(screen.queryByText('QA internal group')).toBeNull();
	expect(view.container.querySelectorAll('.sessionsListItem')).toHaveLength(
		0
	);
	fireEvent.change(search, { target: { value: '' } });
	expect(within(list).getByText('QA internal group')).toBeTruthy();
	expect(within(list).getByText('First client')).toBeTruthy();
	expect(within(list).getByText('Second client')).toBeTruthy();
	expect(list.querySelectorAll('.sessionsListItem')).toHaveLength(3);
	expect(
		screen.queryByText('sessionList.toolbar.emptyFilterResult')
	).toBeNull();
});
