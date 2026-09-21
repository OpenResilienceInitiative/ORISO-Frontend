import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import {
	GroupChatInfoM3,
	type GroupChatInfoM3Props,
	type GroupChatInfoSetting
} from './GroupChatInfoM3';
import { GroupChatCalendarMenu } from '../GroupChatCalendarMenu';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage
} from '../groupChatStageStoryShell';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

/**
 * #1499 item 2 — design proposal for the group "Chat-Info" in Material 3,
 * inside the white chat card. Not wired into the app: Frank approves the look
 * first, then `GroupChatInfo` maps its data onto these props.
 *
 * Content is the one from Frank's screenshot of 21.09.2026 (self-help group
 * "HIV und Aids", before start).
 */

const desktop1280Globals = { viewport: { value: 'desktop1280' } };

const START = new Date(2026, 8, 21, 14, 34);

const SETTINGS: GroupChatInfoSetting[] = [
	{ key: 'topic', label: 'Thema des Chats', value: 'HIV und Aids' },
	{ key: 'date', label: 'Datum', value: 'Mo, 21.09.26' },
	{ key: 'time', label: 'Beginn', value: '14:34 Uhr' },
	{ key: 'duration', label: 'Dauer', value: '1 Stunde' },
	{ key: 'repetition', label: 'Wiederholungen', value: 'einmalig' },
	{
		key: 'agency',
		label: 'Beratungsstelle',
		value: 'Träger Stuttgart21 · Beratungsstelle Mitte'
	}
];

const baseArgs: GroupChatInfoM3Props = {
	topic: 'HIV und Aids',
	scheduleSummary: 'Mo, 21.09.26 · 14:34 Uhr · 1 Stunde',
	statusLabel: 'Geplant',
	active: false,
	calendarAction: (
		<GroupChatCalendarMenu
			start={START}
			durationMinutes={60}
			eventId={GROUP_STAGE_CHAT_ID}
		/>
	),
	participants: [
		{ id: 'p1', name: 'beraterin_admin_1_sep21', isModerator: true },
		{ id: 'p2', name: 'sanftes Alpaka Mika' },
		{ id: 'p3', name: 'ruhiges Yak Kim' }
	],
	canModerate: true,
	participantMenuLabel: (name) => `Optionen für ${name}`,
	teamRoles: [
		{ id: 'c1', name: 'Beraterin_Admin_1 Sep21', role: 'OWNER' },
		{ id: 'c2', name: 'Berater Jonas Weber', role: 'CO_MODERATOR' }
	],
	settings: SETTINGS,
	onShowQrCode: fn(),
	onCopyInviteLink: fn(),
	onParticipantMenu: fn(),
	onEdit: fn(),
	onBack: fn()
};

/** The app's white chat card (`.session`) around the proposal. */
const InCard = (props: GroupChatInfoM3Props) => (
	<div className="session">
		<GroupChatInfoM3 {...props} />
	</div>
);

const StageRender = (layout: 'desktop' | 'mobile') =>
	function Render(args: GroupChatInfoM3Props) {
		const listItem = React.useMemo(() => buildGroupStageListItem(3600), []);
		return (
			<GroupChatStage listItem={listItem} layout={layout}>
				<InCard {...args} />
			</GroupChatStage>
		);
	};

const meta = {
	title: 'Chat info/Group',
	component: GroupChatInfoM3,
	tags: ['autodocs'],
	args: baseArgs,
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: `/sessions/consultant/sessionView/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}/groupChatInfo`
		},
		docs: {
			description: {
				component:
					'#1499 item 2 — design proposal: the self-help group\'s "Chat-Info" as a Material 3 surface inside the white chat card. Top bar with back action; hero with topic, status and schedule plus "Zum Kalender hinzufügen"; section cards for participants (QR code, invite link, per-person menu for moderators), roles in the counselling team, and the room settings as an M3 list with leading icons. Two columns from a 720 px wide card, one column below. Colours only from the M3 custom properties. Not wired into the app yet.'
			}
		}
	}
} satisfies Meta<typeof GroupChatInfoM3>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop1440: Story = {
	name: 'Stage · 1440',
	globals: desktop1440Globals,
	render: StageRender('desktop'),
	play: async ({ canvas, args }) => {
		await userEvent.click(
			canvas.getByRole('button', { name: /Einladungs-Link kopieren/ })
		);
		await expect(args.onCopyInviteLink).toHaveBeenCalledTimes(1);

		await userEvent.click(
			canvas.getByRole('button', { name: /QR-Code anzeigen/ })
		);
		await expect(args.onShowQrCode).toHaveBeenCalledTimes(1);

		// Moderators have no ban menu; the other participants do.
		await expect(
			canvas.queryByRole('button', {
				name: 'Optionen für beraterin_admin_1_sep21'
			})
		).toBeNull();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Optionen für ruhiges Yak Kim' })
		);
		await expect(args.onParticipantMenu).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'p3' }),
			expect.anything()
		);

		await userEvent.click(
			canvas.getByRole('button', { name: /Bearbeiten/ })
		);
		await expect(args.onEdit).toHaveBeenCalledTimes(1);

		await userEvent.click(canvas.getByRole('button', { name: 'Zurück' }));
		await expect(args.onBack).toHaveBeenCalledTimes(1);
	}
};

export const Desktop1280: Story = {
	name: 'Stage · 1280',
	globals: desktop1280Globals,
	render: StageRender('desktop'),
	play: async ({ canvas }) => {
		// Every room setting is listed with its label.
		for (const setting of SETTINGS) {
			await expect(canvas.getByText(setting.label)).toBeVisible();
		}
	}
};

export const Mobile390: Story = {
	name: 'Stage · 390 mobile',
	globals: phone390Globals,
	render: StageRender('mobile'),
	play: async ({ canvas, canvasElement }) => {
		const calendar = canvas.getByRole('button', {
			name: 'Zum Kalender hinzufügen'
		});
		await userEvent.click(calendar);
		await waitFor(() =>
			expect(calendar).toHaveAttribute('aria-expanded', 'true')
		);
		await userEvent.keyboard('{Escape}');
		// Nothing overflows the phone width.
		const root = canvasElement.querySelector<HTMLElement>(
			'[data-testid="group-chat-info-m3"]'
		);
		await expect(root!.scrollWidth).toBeLessThanOrEqual(
			root!.clientWidth + 1
		);
	}
};

/** The room is open: status chip in the primary role, no edit action. */
export const Running: Story = {
	name: 'Card · running, not owner',
	globals: desktop1440Globals,
	args: {
		statusLabel: 'Läuft gerade',
		active: true,
		onEdit: undefined,
		canModerate: false
	},
	render: StageRender('desktop'),
	play: async ({ canvas }) => {
		await expect(canvas.getByText('Läuft gerade')).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /Bearbeiten/ })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: /^Optionen für/ })
		).toBeNull();
	}
};

/** Nobody has joined yet. */
export const NoParticipants: Story = {
	name: 'Card · no participants',
	globals: desktop1440Globals,
	args: { participants: [] },
	render: (args) => (
		<div style={{ height: '100vh', display: 'flex', padding: 0 }}>
			<InCard {...args} />
		</div>
	),
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText('keine Teilnehmenden vorhanden')
		).toBeVisible();
	}
};
