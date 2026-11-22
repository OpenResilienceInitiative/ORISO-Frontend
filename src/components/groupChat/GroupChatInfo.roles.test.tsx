// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
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
import { apiPostBanUser } from '../../api/apiPostBanUser';
import { ActiveSessionContext } from '../../globalState';
import { GroupChatInfoM3Connected } from './GroupChatInfo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: { name?: string; number?: number }) =>
			[key, values?.name ?? values?.number].filter(Boolean).join(' ')
	})
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

const room = vi.hoisted(() => ({ joined: [] as any[] }));
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({
		users: [
			...room.joined,
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
vi.mock('../../api/apiPostBanUser', () => ({ apiPostBanUser: vi.fn() }));
vi.mock('../../api', () => ({
	apiGetGroupChatInfo: vi.fn(() => Promise.resolve({ bannedUsers: [] })),
	apiPutGroupChat: vi.fn(),
	GROUP_CHAT_API: {}
}));

const connectedUi = (
	isCurrentUserModerator = false,
	onBanned: (name: string) => void = () => {}
) => (
	<MemoryRouter>
		<GroupChatInfoM3Connected
			topic="Gruppe"
			settings={[]}
			isCurrentUserModerator={isCurrentUserModerator}
			showInviteActions={false}
			inviteLink={{ url: '', copyRegistrationLink: () => {} } as any}
			onBanned={onBanned}
			onBanFailed={() => {}}
			onShowQr={() => {}}
		/>
	</MemoryRouter>
);

const renderConnected = () => render(connectedUi());

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

	// CodeRabbit on #1986: someone who joins while Chat-Info is open gets a badge too.
	it('reads the roles again when someone joins while the page is open', async () => {
		room.joined = [];
		vi.mocked(apiGetChatMembers)
			.mockResolvedValueOnce({ members: [] })
			.mockResolvedValueOnce({
				members: [{ _id: '@late:hs', role: 'ADVICE_SEEKER' }]
			});
		const view = renderConnected();
		await waitFor(() => expect(apiGetChatMembers).toHaveBeenCalledTimes(1));

		room.joined = [
			{ _id: '@late:hs', username: 'late', displayName: 'Lena' }
		];
		view.rerender(connectedUi());

		await waitFor(() =>
			expect(
				within(rowOf('Lena')).getByText(
					'groupChat.info.subscribers.role.asker'
				)
			).toBeTruthy()
		);
		room.joined = [];
	});

	// The server only removes advice seekers (ORISO-Admin#1518 follow-up):
	// a remove action on a counsellor's row ended in an error.
	it('offers a moderator the remove action on advice seekers only', async () => {
		vi.mocked(apiGetChatMembers).mockResolvedValue({
			members: [
				{ _id: '@asker:hs', role: 'ADVICE_SEEKER' },
				{ _id: '@consultant:hs', role: 'CONSULTANT' },
				{ _id: '@supervisor:hs', role: 'CONSULTANT' }
			]
		});

		render(connectedUi(true));

		await waitFor(() =>
			expect(
				within(rowOf('Bea')).queryByRole('button', {
					name: 'groupChat.info.subscribers.menuLabel Bea'
				})
			).toBeNull()
		);
		expect(
			within(rowOf('Clara')).queryByRole('button', {
				name: 'groupChat.info.subscribers.menuLabel Clara'
			})
		).toBeNull();
		expect(
			within(rowOf('Anna')).getByRole('button', {
				name: 'groupChat.info.subscribers.menuLabel Anna'
			})
		).toBeTruthy();
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

const credentialOwner = 'legacy.owner_at_example.test';
const credentialAsker = 'other.asker_at_example.org';
const protectedLabel = 'groupChat.info.subscribers.protectedName';
const protectedRoster = [
	{
		_id: '@a-owner:hs',
		username: credentialOwner,
		displayName: credentialOwner
	},
	{
		_id: '@b-asker:hs',
		username: credentialAsker,
		displayName: credentialAsker
	}
];

const renderCircle = (
	item: { conversationType?: string; repeatCount?: number },
	moderator = false,
	onBanned = vi.fn()
) => {
	const value = {
		activeSession: {
			isGroup: true,
			item: { id: 7, active: false, ...item }
		}
	} as React.ContextType<typeof ActiveSessionContext>;
	return render(
		<ActiveSessionContext.Provider value={value}>
			{connectedUi(moderator, onBanned)}
		</ActiveSessionContext.Provider>
	);
};

describe('self-help Chat-Info participant names', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		room.joined = [...protectedRoster];
	});
	afterEach(() => {
		room.joined = [];
		cleanup();
	});

	it.each([
		['explicit self-help modality', { conversationType: 'SELF_HELP' }],
		['legacy recurring group', { repeatCount: 2 }]
	])(
		'does not show either credential profile name for %s',
		(_label, item) => {
			renderCircle(item);

			expect(screen.queryByText(credentialOwner)).toBeNull();
			expect(screen.queryByText(credentialAsker)).toBeNull();
			expect(screen.getByText(`${protectedLabel} 1`)).toBeTruthy();
			expect(screen.getByText(`${protectedLabel} 3`)).toBeTruthy();
		}
	);

	it('keeps the safe explicit label and falls back to a safe existing alias', () => {
		room.joined = [
			{
				_id: '@first:hs',
				username: credentialOwner,
				displayName: 'Sanftes Alpaka'
			},
			{
				_id: '@second:hs',
				username: 'ruhiges_yak',
				displayName: 'other.asker@example.org'
			},
			{ _id: '@third:hs', username: 'anon_123' },
			{ _id: '@fourth:hs', username: 'another.asker@example.test' }
		];
		renderCircle({ conversationType: 'SELF_HELP' });

		expect(screen.getByText('Sanftes Alpaka')).toBeTruthy();
		expect(screen.getByText('ruhiges_yak')).toBeTruthy();
		expect(screen.getByText('anon_123')).toBeTruthy();
		expect(screen.queryByText('other.asker@example.org')).toBeNull();
		expect(screen.queryByText('another.asker@example.test')).toBeNull();
	});

	it('keeps the moderation target while using the safe label in the controls and result', async () => {
		const onBanned = vi.fn();
		vi.mocked(apiPostBanUser).mockResolvedValue(undefined);
		renderCircle({ conversationType: 'SELF_HELP' }, true, onBanned);

		const targetName = `${protectedLabel} 3`;
		fireEvent.click(
			screen.getByRole('button', {
				name: `groupChat.info.subscribers.menuLabel ${targetName}`
			})
		);
		fireEvent.click(
			await screen.findByRole('menuitem', { name: 'banUser.ban.trigger' })
		);
		expect(
			screen.getByRole('dialog', {
				name: `banUser.confirm.title ${targetName}`
			})
		).toBeTruthy();
		fireEvent.click(screen.getByTestId('ban-user-confirm-submit'));

		await waitFor(() => expect(onBanned).toHaveBeenCalledWith(targetName));
		expect(apiPostBanUser).toHaveBeenCalledWith({
			chatId: 7,
			matrixUserId: '@b-asker:hs'
		});
	});

	it('preserves the independent internal group labels', () => {
		renderCircle({ conversationType: 'INTERNAL_GROUP' });
		expect(screen.getByText(credentialOwner)).toBeTruthy();
	});
});
