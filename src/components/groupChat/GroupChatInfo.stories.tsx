import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Route, Routes } from 'react-router-dom';
import { TenantContext } from '../../globalState';
import type { ListItemInterface } from '../../globalState/interfaces';
import { chatTransportService } from '../../services/chatTransportService';
import { GroupChatInfo } from './GroupChatInfo';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage,
	groupStageConsultant
} from './groupChatStageStoryShell';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';

/**
 * #1499 item 2 — the real `GroupChatInfo` route, wired to the approved M3
 * surface (`Chat info/Group`). Data comes from mocked user-service responses
 * and a mocked Matrix member list, so every action runs its production code:
 * calendar menu, QR code, invite link, the ban menu per member, role
 * management and "Bearbeiten" into the settings form.
 */

const INFO_PATH = `/sessions/consultant/sessionView/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}/groupChatInfo`;

const buildListItem = (): ListItemInterface => {
	const item = buildGroupStageListItem(3600);
	Object.assign(item.chat as object, {
		modality: 'TEXT',
		participants: [
			{
				consultantId: groupStageConsultant.userId,
				role: 'OWNER',
				displayName: 'Beraterin_Admin_1 Sep21'
			},
			{
				consultantId: 'consultant-jonas',
				role: 'CO_MODERATOR',
				displayName: 'Berater Jonas Weber'
			}
		],
		assignedAgencies: [{ id: 1, name: 'Beratungsstelle Mitte' }]
	});
	return item;
};

const MEMBERS = [
	{
		userId: '@beraterin_admin_1_sep21:example.org',
		name: 'beraterin_admin_1_sep21'
	},
	{ userId: '@sanftes-alpaka-mika:example.org', name: 'sanftes Alpaka Mika' },
	{ userId: '@ruhiges-yak-kim:example.org', name: 'ruhiges Yak Kim' }
];

/**
 * Installs the mocks during render, before any child effect asks for data,
 * and restores fetch and the Matrix service when the story unmounts.
 */
const useBackendMocks = (listItem: ListItemInterface) => {
	const installed = React.useRef<(() => void) | null>(null);
	if (!installed.current) {
		const originalFetch = globalThis.fetch;
		const service = chatTransportService as any;
		const originalLoad = service.loadMatrixRoomMembers;
		const originalOn = service.onMatrixRoomMembers;
		// The moderator list uses Matrix ids, as the real room does.
		(listItem.chat as any).moderators = [MEMBERS[0].userId];
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.includes('/service/users/sessions/room')) {
				return new Response(JSON.stringify({ sessions: [listItem] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (url.includes('/service/users/chat/')) {
				return new Response(JSON.stringify({ active: false }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return originalFetch(input, init);
		};
		service.loadMatrixRoomMembers = async () => MEMBERS;
		service.onMatrixRoomMembers = () => () => undefined;
		installed.current = () => {
			globalThis.fetch = originalFetch;
			service.loadMatrixRoomMembers = originalLoad;
			service.onMatrixRoomMembers = originalOn;
		};
	}
	React.useEffect(
		() => () => {
			installed.current?.();
		},
		[]
	);
};

const WiredChatInfo = ({ layout }: { layout: 'desktop' | 'mobile' }) => {
	const listItem = React.useMemo(buildListItem, []);
	useBackendMocks(listItem);
	return (
		<TenantContext.Provider
			value={
				{
					tenant: {
						id: 1,
						settings: { featureGroupChatV2Enabled: true }
					},
					setTenant: () => undefined
				} as any
			}
		>
			<GroupChatStage listItem={listItem} layout={layout}>
				<Routes>
					<Route
						path="/sessions/consultant/sessionView/:groupId/:sessionId/groupChatInfo"
						element={<GroupChatInfo />}
					/>
					<Route
						path="/sessions/consultant/sessionView/:groupId/:sessionId/editGroupChat"
						element={<p>Einstellungen für den Gesprächskreis</p>}
					/>
					<Route path="*" element={<p>Chat</p>} />
				</Routes>
			</GroupChatStage>
		</TenantContext.Provider>
	);
};

const meta = {
	title: 'Chat info/Group (app)',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: INFO_PATH },
		docs: {
			description: {
				component:
					'#1499 — the production `GroupChatInfo` route rendering the approved M3 Chat-Info inside the white chat card, with mocked user-service and Matrix data.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wired1440: Story = {
	name: 'Wired · 1440',
	globals: desktop1440Globals,
	render: () => <WiredChatInfo layout="desktop" />,
	play: async ({ canvas }) => {
		await canvas.findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
		// Moderator row has no menu; a participant's opens the ban action.
		await expect(
			canvas.queryByRole('button', {
				name: 'Optionen für beraterin_admin_1_sep21'
			})
		).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Optionen für ruhiges Yak Kim' })
		);
		const ban = await waitFor(() =>
			document.querySelector<HTMLElement>('[role="menuitem"]')
		);
		await expect(ban).toHaveTextContent('Bannen');
		await userEvent.keyboard('{Escape}');

		// Role management stays interactive for the owner.
		await expect(
			canvas.getByLabelText('Rolle für Berater Jonas Weber')
		).toBeVisible();
	}
};

/** "Bearbeiten" opens the settings form in edit mode. */
export const WiredEdit: Story = {
	name: 'Wired · Bearbeiten opens the settings form',
	globals: desktop1440Globals,
	render: () => <WiredChatInfo layout="desktop" />,
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole(
				'button',
				{ name: /Bearbeiten/ },
				{ timeout: 5000 }
			)
		);
		await canvas.findByText('Einstellungen für den Gesprächskreis');
	}
};

export const Wired390: Story = {
	name: 'Wired · 390 mobile',
	globals: phone390Globals,
	render: () => <WiredChatInfo layout="mobile" />,
	play: async ({ canvas }) => {
		await canvas.findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
		await expect(
			canvas.getByRole('button', { name: /QR-Code anzeigen/ })
		).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: /Einladungs-Link kopieren/ })
		).toBeVisible();
	}
};
