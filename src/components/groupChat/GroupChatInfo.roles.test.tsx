// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import { GroupChatInfoM3Connected } from './GroupChatInfo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../globalState', async () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		AUTHORITIES: {},
		hasUserAuthority: () => false,
		useTenant: () => ({ settings: {} }),
		UserDataContext: react.createContext({ userData: {} }),
		SessionTypeContext: react.createContext({ path: '/sessions' }),
		ActiveSessionContext: react.createContext({
			activeSession: { item: { id: 7, active: true } }
		}),
		NotificationsContext: react.createContext({}),
		SessionsDataContext: react.createContext({ dispatch: () => undefined }),
		REMOVE_SESSIONS: 'REMOVE_SESSIONS',
		ActiveSessionProvider: ({ children }: any) => children
	};
});

vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({
		users: [
			{ _id: '@asker:hs', username: 'asker', displayName: 'Anna' },
			{
				_id: '@consultant:hs',
				username: 'consultant',
				displayName: 'Bea',
				powerLevel: 50
			},
			{
				_id: '@supervisor:hs',
				username: 'supervisor',
				displayName: 'Clara',
				powerLevel: 10
			}
		],
		moderators: []
	})
}));
vi.mock('../../api/apiGetChatMembers', () => ({ apiGetChatMembers: vi.fn() }));
vi.mock('../../api', () => ({
	apiGetGroupChatInfo: vi.fn(() => Promise.resolve({ bannedUsers: [] })),
	apiPutGroupChat: vi.fn(),
	GROUP_CHAT_API: {}
}));

const renderConnected = () =>
	render(
		<MemoryRouter>
			<GroupChatInfoM3Connected
				topic="Gruppe"
				settings={[]}
				isCurrentUserModerator={false}
				showInviteActions={false}
				inviteLink={{ url: '', copyRegistrationLink: () => {} } as any}
				onBanned={() => {}}
				onBanFailed={() => {}}
				onShowQr={() => {}}
			/>
		</MemoryRouter>
	);

const rowOf = (name: string) =>
	screen.getByText(name).closest('li') as HTMLElement;

/** OBP 2.1 #107: everyone, advice seekers included, sees every role. */
describe('Chat-Info participant roles', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

	it('labels each participant with the role the server and the room report', async () => {
		vi.mocked(apiGetChatMembers).mockResolvedValue({
			members: [
				{ _id: '@asker:hs', role: 'ADVICE_SEEKER' },
				{ _id: '@consultant:hs', role: 'CONSULTANT' },
				{ _id: '@supervisor:hs', role: 'CONSULTANT' }
			]
		});

		renderConnected();

		await waitFor(() =>
			expect(
				within(rowOf('Anna')).getByText(
					'groupChat.info.subscribers.role.asker'
				)
			).toBeTruthy()
		);
		expect(
			within(rowOf('Bea')).getByText(
				'groupChat.info.subscribers.role.consultant'
			)
		).toBeTruthy();
		expect(
			within(rowOf('Clara')).getByText(
				'groupChat.info.subscribers.role.supervisor'
			)
		).toBeTruthy();
		expect(apiGetChatMembers).toHaveBeenCalledWith(7);
	});

	it('still lists everyone by name when the roles cannot be read', async () => {
		vi.mocked(apiGetChatMembers).mockRejectedValue(new Error('CATCH_ALL'));

		renderConnected();

		await waitFor(() => expect(apiGetChatMembers).toHaveBeenCalled());
		expect(rowOf('Anna')).toBeTruthy();
		expect(
			rowOf('Clara').querySelector('[data-cy="participant-role"]')
		).toBeNull();
	});
});
