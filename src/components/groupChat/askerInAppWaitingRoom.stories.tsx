import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { JoinGroupChatView } from './JoinGroupChatView';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage,
	groupStageAsker
} from './groupChatStageStoryShell';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import type { GroupChatItemInterface } from '../../globalState/interfaces';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import { expectWaitingRoomLayout } from '../app/registrationLoader/waitingRoomLayoutContract';

/**
 * #1219 — the self-help group's waiting room as an advice seeker sees it in
 * the app, after opening the group from the session list: the same room as
 * behind the group's link (`GroupWaitingRoom`: clock, "Mehr erfahren", the
 * bar with calendar and "Beitreten"), standing in the white chat card instead
 * of on the stage. Frank, 2026-10-16: picture A (in the app) must look like
 * picture B (behind the link).
 */

const FUTURE_SECONDS = 2 * 86400 + 3 * 3600 + 21 * 60 + 50;

type Variant = 'future' | 'open' | 'noTime';

const buildItem = (variant: Variant) => {
	// An open room started a few minutes ago; the others start in two days.
	const item = buildGroupStageListItem(
		variant === 'open' ? -4 * 60 : FUTURE_SECONDS
	);
	const chat = item.chat as GroupChatItemInterface & {
		startDate?: string;
		startTime?: string;
	};
	chat.assignedAgencies = [
		{ id: 0, name: 'Beratungsstelle Lichtenberg' }
	] as GroupChatItemInterface['assignedAgencies'];
	if (variant === 'open') {
		// The moderator has opened the room; the seeker is not in it yet.
		chat.active = true;
		chat.subscribed = false;
	}
	if (variant === 'noTime') {
		delete chat.startDate;
		delete chat.startTime;
	}
	return item;
};

const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

const Stage = ({
	layout,
	variant
}: {
	layout: 'desktop' | 'mobile';
	variant: Variant;
}) => {
	const listItem = React.useMemo(() => buildItem(variant), [variant]);
	return (
		<GroupChatStage
			listItem={listItem}
			layout={layout}
			viewer={groupStageAsker}
		>
			{/* The platform's documents, so the consent sentence carries its
			    two links as in the app. */}
			<LegalLinksContext.Provider value={legalLinks}>
				<JoinGroupChatView />
			</LegalLinksContext.Provider>
		</GroupChatStage>
	);
};

/** The shared waiting-room contract, in its chat-card form. */
const expectCardRoom = (canvasElement: HTMLElement) =>
	expectWaitingRoomLayout(canvasElement, { frame: 'card' });

const joinButton = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLButtonElement>(
		'[data-testid="group-entry-join"]'
	);

const meta = {
	title: 'Group chat/In-app waiting room (advice seeker)',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: `/sessions/user/view/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
		},
		docs: {
			description: {
				component:
					'#1219 — the self-help group before it starts, as an advice seeker sees it in the app: the same `GroupWaitingRoom` as behind the group link, embedded in the white chat card. "Beitreten" stays visible and locked until the moderator opens the room.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Future1440: Story = {
	name: 'Before the start · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="future" />,
	play: async ({ canvasElement }) => {
		await expectCardRoom(canvasElement);
		await waitFor(() => expect(joinButton(canvasElement)).not.toBeNull());
		await expect(joinButton(canvasElement)).toHaveTextContent('Beitreten');
		await expect(joinButton(canvasElement)).toBeDisabled();
		await expect(
			canvasElement.querySelector('[data-testid="group-entry-calendar"]')
		).not.toBeNull();
	}
};

export const Future390: Story = {
	name: 'Before the start · 390 mobile',
	globals: phone390Globals,
	render: () => <Stage layout="mobile" variant="future" />,
	play: async ({ canvasElement }) => {
		await expectCardRoom(canvasElement);
		await expect(joinButton(canvasElement)).toBeDisabled();
	}
};

export const NoTime1440: Story = {
	name: 'No fixed time · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="noTime" />,
	play: async ({ canvasElement }) => {
		await expectCardRoom(canvasElement);
		await expect(joinButton(canvasElement)).toBeDisabled();
	}
};

export const Open1440: Story = {
	name: 'Room open · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="open" />,
	play: async ({ canvasElement }) => {
		await expectCardRoom(canvasElement);
		await waitFor(() => expect(joinButton(canvasElement)).toBeEnabled());
		/* #1787, Frank 2026-10-19: a running group says so — calm, grey,
		   never the red overdue clock. */
		await expect(
			within(canvasElement).getByText(/Die Gruppe hat .*begonnen\./)
		).toBeVisible();
		await expect(
			canvasElement.querySelector('[data-cy="group-running"]')
		).toHaveTextContent('Läuft gerade');
		await expect(
			within(canvasElement).queryByText('Die Gruppe beginnt gleich.')
		).toBeNull();
	}
};

/**
 * Frank, 2026-10-17: "Beitreten" in the app opens the same consent sheet as
 * behind the link — waving hand, checkbox, round X — inside the chat card,
 * with whose privacy statement the person agrees to.
 */
export const OpenConsent1440: Story = {
	name: 'Room open · "Beitreten" asks for consent · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="open" />,
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(joinButton(canvasElement)).toBeEnabled());
		await userEvent.click(joinButton(canvasElement)!);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'.session.joinChat [role="checkbox"], .session.joinChat input[type="checkbox"]'
				)
			).not.toBeNull()
		);
		// The contract waits until the sliding consent bar has arrived.
		await expectCardRoom(canvasElement);
	}
};
