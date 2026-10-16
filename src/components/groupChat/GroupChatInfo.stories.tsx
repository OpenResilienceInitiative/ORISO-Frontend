import * as React from 'react';
import i18n from 'i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Route, Routes } from 'react-router-dom';
import { TenantContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import type { ListItemInterface } from '../../globalState/interfaces';
import { chatTransportService } from '../../services/chatTransportService';
import { GroupChatInfo } from './GroupChatInfo';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage,
	groupStageAsker,
	groupStageConsultant
} from './groupChatStageStoryShell';
import {
	desktop1440Globals,
	phone375Globals,
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

const buildListItem = (inviteToken: string | null = 'Ab3_x-Yz') => {
	const item: ListItemInterface = buildGroupStageListItem(3600);
	Object.assign(item.chat as object, {
		modality: 'TEXT',
		inviteToken,
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
const useBackendMocks = (
	listItem: ListItemInterface,
	bannedUsers: string[] = []
) => {
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
				return new Response(
					JSON.stringify({ active: false, bannedUsers }),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
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

/** Legacy overlays portal into a body-level `#overlay`, as in app.html. */
const BodyOverlayHost = () => {
	React.useEffect(() => {
		const host = document.createElement('div');
		host.id = 'overlay';
		document.body.appendChild(host);
		return () => host.remove();
	}, []);
	return null;
};

const WiredChatInfo = ({
	layout,
	inviteToken,
	asAsker = false,
	dialog = false,
	joined = true,
	banned = false
}: {
	layout: 'desktop' | 'mobile';
	inviteToken?: string | null;
	asAsker?: boolean;
	dialog?: boolean;
	/** False: the viewer has not joined the group yet. */
	joined?: boolean;
	/** True: the viewer is on the group's ban list. */
	banned?: boolean;
}) => {
	const listItem = React.useMemo(() => {
		const item = buildListItem(inviteToken);
		(item.chat as any).subscribed = joined;
		return item;
	}, [inviteToken, joined]);
	useBackendMocks(listItem, banned ? [groupStageAsker.userName] : []);
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
			<GroupChatStage
				listItem={listItem}
				layout={layout}
				viewer={asAsker ? groupStageAsker : undefined}
			>
				<Routes>
					<Route
						path="/sessions/consultant/sessionView/:groupId/:sessionId/groupChatInfo"
						element={
							dialog ? (
								<ModalProvider>
									<p>Chat</p>
									<GroupChatInfo dialog />
									<BodyOverlayHost />
								</ModalProvider>
							) : (
								<GroupChatInfo />
							)
						}
					/>
					<Route
						path="/sessions/consultant/sessionView/:groupId/:sessionId/editGroupChat"
						element={<p>Einstellungen für den Gesprächskreis</p>}
					/>
					<Route
						path="*"
						element={<p data-testid="chat-route">Chat</p>}
					/>
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
		).toBeEnabled();
	}
};

/** A group without an invite token: no link to copy or scan yet (#1499). */
export const WiredNoInviteToken: Story = {
	name: 'Wired · no invite token yet',
	globals: phone390Globals,
	render: () => <WiredChatInfo layout="mobile" inviteToken={null} />,
	play: async ({ canvas }) => {
		await canvas.findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
		await expect(
			canvas.getByRole('button', { name: /QR-Code anzeigen/ })
		).toBeDisabled();
		await expect(
			canvas.getByRole('button', { name: /Einladungs-Link kopieren/ })
		).toBeDisabled();
	}
};

/** An advice seeker sees the members but not the team roles, the creator or the invite ways. */
export const WiredAsAsker: Story = {
	name: 'Wired · advice seeker sees no roles, creator or invite',
	globals: desktop1440Globals,
	render: () => <WiredChatInfo layout="desktop" asAsker />,
	play: async ({ canvas }) => {
		await canvas.findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
		await expect(
			canvas.queryByLabelText('Rolle für Berater Jonas Weber')
		).toBeNull();
		await expect(canvas.queryByText('Berater Jonas Weber')).toBeNull();
		await expect(canvas.queryByText('Beraterin_Admin_1 Sep21')).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: /QR-Code anzeigen/ })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: /Einladungs-Link kopieren/ })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', {
				name: 'Optionen für sanftes Alpaka Mika'
			})
		).toBeNull();
	}
};

const desktop1366Globals = { viewport: { value: 'desktop1366' } };
const desktop1920Globals = { viewport: { value: 'desktop1920' } };

/** The header's "Information & settings" opens on top (#1760); ✕ returns to the chat. */
const closesWithTheCrossButton: Story['play'] = async () => {
	const page = within(document.body);
	const dialog = await page.findByRole('dialog', {}, { timeout: 5000 });
	await within(dialog).findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
	// Wait out the dialog's fade-in.
	await waitFor(() =>
		expect(
			within(dialog).getByRole('heading', {
				name: i18n.t('groupChat.info.headline')
			})
		).toBeVisible()
	);
	const close = within(dialog).getByRole('button', {
		name: i18n.t('app.close')
	});
	await expect(close).toBeVisible();
	await userEvent.click(close);
	await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
	await expect(page.getByText('Chat')).toBeVisible();
};

export const Dialog1366: Story = {
	name: 'Dialog · 1366 opens on top, ✕ closes',
	globals: desktop1366Globals,
	render: () => <WiredChatInfo layout="desktop" dialog />,
	play: closesWithTheCrossButton
};

export const Dialog1920: Story = {
	name: 'Dialog · 1920 Escape closes',
	globals: desktop1920Globals,
	render: () => <WiredChatInfo layout="desktop" dialog />,
	play: async () => {
		const page = within(document.body);
		const dialog = await page.findByRole('dialog', {}, { timeout: 5000 });
		await within(dialog).findByText(
			'ruhiges Yak Kim',
			{},
			{ timeout: 5000 }
		);
		await waitFor(() =>
			expect(
				within(dialog).getByRole('button', {
					name: i18n.t('app.close')
				})
			).toBeVisible()
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
	}
};

export const Dialog390: Story = {
	name: 'Dialog · 390 full screen, ✕ closes',
	globals: phone390Globals,
	render: () => <WiredChatInfo layout="mobile" dialog />,
	play: closesWithTheCrossButton
};

export const Dialog375: Story = {
	name: 'Dialog · 375 full screen, ✕ closes',
	globals: phone375Globals,
	render: () => <WiredChatInfo layout="mobile" dialog />,
	play: closesWithTheCrossButton
};

/** The QR code is a legacy overlay: the dialog steps aside and comes back. */
export const DialogQrCode: Story = {
	name: 'Dialog · QR code shows above, dialog returns unchanged',
	globals: desktop1366Globals,
	render: () => <WiredChatInfo layout="desktop" dialog />,
	play: async () => {
		const page = within(document.body);
		const dialog = await page.findByRole('dialog', {}, { timeout: 5000 });
		await within(dialog).findByText(
			'ruhiges Yak Kim',
			{},
			{ timeout: 5000 }
		);
		// The Chat-Info must survive the overlay: same node, same scroll.
		const content = within(dialog).getByTestId('group-chat-info-m3');
		const body = dialog.querySelector<HTMLElement>('.m3Dialog__body')!;
		body.scrollTop = 80;
		const scrolled = body.scrollTop;
		await userEvent.click(
			within(dialog).getByRole('button', {
				name: i18n.t('qrCode.link.text')
			})
		);
		await waitFor(() =>
			expect(
				page.getByAltText(i18n.t('qrCode.overlay.image.alt'))
			).toBeVisible()
		);
		await waitFor(() =>
			expect(page.getByTestId('group-chat-info-dialog')).not.toBeVisible()
		);
		// The legacy overlay's ✕ is an SVG with a label, not a button.
		const overlay = within(document.getElementById('overlay')!);
		await userEvent.click(overlay.getByLabelText(i18n.t('app.close')));
		await waitFor(() =>
			expect(page.getByTestId('group-chat-info-dialog')).toBeVisible()
		);
		await expect(content.isConnected).toBe(true);
		await expect(
			within(document.body).getByTestId('group-chat-info-m3')
		).toBe(content);
		await expect(body.scrollTop).toBe(scrolled);
	}
};

/** Opens on top and waits until the dialog has faded in. */
const findOpenDialog = async () => {
	const page = within(document.body);
	const dialog = await page.findByRole('dialog', {}, { timeout: 5000 });
	await waitFor(() =>
		expect(
			within(dialog).getByRole('heading', {
				name: i18n.t('groupChat.info.headline')
			})
		).toBeVisible()
	);
	return within(dialog);
};

/** Not joined yet (#1760): date, start, duration, repetition and agency; no topic before consent, no members, no invite ways. */
const showsScheduleOnly: Story['play'] = async () => {
	const dialog = await findOpenDialog();
	for (const key of [
		'groupChat.info.settings.startDate',
		'groupChat.info.settings.startTime',
		'groupChat.info.settings.duration',
		'groupChat.info.settings.repetition.label',
		'groupChat.info.settings.agency'
	]) {
		await expect(dialog.getByText(i18n.t(key))).toBeVisible();
	}
	await expect(dialog.getByText('Beratungsstelle Mitte')).toBeVisible();
	// No privacy consent on record in this fixture: no topic, as in the waiting room.
	await expect(
		dialog.queryByText(i18n.t('groupChat.info.settings.topic'))
	).toBeNull();
	await expect(
		dialog.queryByText(i18n.t('groupChat.info.subscribers.headline'))
	).toBeNull();
	for (const member of MEMBERS) {
		await expect(dialog.queryByText(member.name)).toBeNull();
	}
	await expect(
		dialog.queryByRole('button', { name: i18n.t('qrCode.link.text') })
	).toBeNull();
	await expect(
		dialog.queryByRole('button', { name: /Einladungs-Link kopieren/ })
	).toBeNull();
	await expect(
		dialog.queryByRole('button', { name: /Bearbeiten/ })
	).toBeNull();
};

export const DialogAskerNotJoined1366: Story = {
	name: 'Dialog · advice seeker not joined: schedule only (1366)',
	globals: desktop1366Globals,
	render: () => (
		<WiredChatInfo layout="desktop" dialog asAsker joined={false} />
	),
	play: showsScheduleOnly
};

export const DialogAskerNotJoined390: Story = {
	name: 'Dialog · advice seeker not joined: schedule only (390)',
	globals: phone390Globals,
	render: () => (
		<WiredChatInfo layout="mobile" dialog asAsker joined={false} />
	),
	play: showsScheduleOnly
};

/** A member sees the schedule and the member list, still no invite ways. */
const showsFullInfoForMember: Story['play'] = async () => {
	const dialog = await findOpenDialog();
	await dialog.findByText('ruhiges Yak Kim', {}, { timeout: 5000 });
	await expect(
		dialog.getByText(i18n.t('groupChat.info.subscribers.headline'))
	).toBeVisible();
	await expect(
		dialog.getByText(i18n.t('groupChat.info.settings.startDate'))
	).toBeVisible();
	await expect(dialog.getByText('Beratungsstelle Mitte')).toBeVisible();
	await expect(
		dialog.queryByRole('button', { name: /Einladungs-Link kopieren/ })
	).toBeNull();
};

export const DialogAskerJoined1366: Story = {
	name: 'Dialog · advice seeker joined: full info (1366)',
	globals: desktop1366Globals,
	render: () => <WiredChatInfo layout="desktop" dialog asAsker />,
	play: showsFullInfoForMember
};

export const DialogAskerJoined390: Story = {
	name: 'Dialog · advice seeker joined: full info (390)',
	globals: phone390Globals,
	render: () => <WiredChatInfo layout="mobile" dialog asAsker />,
	play: showsFullInfoForMember
};

/** A banned advice seeker who opens the Chat-Info URL lands back in the chat. */
export const DialogAskerBannedByUrl: Story = {
	name: 'Dialog · banned advice seeker by URL: back to the chat',
	globals: desktop1366Globals,
	render: () => <WiredChatInfo layout="desktop" dialog asAsker banned />,
	play: async ({ canvas }) => {
		// The redirect leaves the Chat-Info route for the chat route.
		await canvas.findByTestId('chat-route', {}, { timeout: 5000 });
		await expect(within(document.body).queryByRole('dialog')).toBeNull();
		await expect(
			within(document.body).queryByText(
				i18n.t('groupChat.info.settings.startDate')
			)
		).toBeNull();
	}
};
