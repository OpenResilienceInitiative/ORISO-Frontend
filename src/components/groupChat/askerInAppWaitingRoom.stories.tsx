import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
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
	const item = buildGroupStageListItem(FUTURE_SECONDS);
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
			<JoinGroupChatView />
		</GroupChatStage>
	);
};

/**
 * The room's bar belongs to the chat card: inside its edges, at its bottom,
 * never over the session list or the navigation.
 */
const expectBarInCard = async (canvasElement: HTMLElement) => {
	const card = canvasElement.querySelector<HTMLElement>('.session.joinChat');
	await expect(card).not.toBeNull();
	await waitFor(() =>
		expect(
			card!.querySelector('[data-cy="registration-footer"]')
		).not.toBeNull()
	);
	const bar = card!.querySelector<HTMLElement>(
		'[data-cy="registration-footer"]'
	)!;
	const cardRect = card!.getBoundingClientRect();
	const barRect = bar.getBoundingClientRect();
	await expect(barRect.left).toBeGreaterThanOrEqual(cardRect.left - 1);
	await expect(barRect.right).toBeLessThanOrEqual(cardRect.right + 1);
	await expect(Math.abs(cardRect.bottom - barRect.bottom)).toBeLessThan(3);
	// The card does not scroll as a whole; only the column above the bar may.
	await expect(card!.scrollHeight).toBeLessThanOrEqual(
		card!.clientHeight + 1
	);
};

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
		await expectBarInCard(canvasElement);
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
		await expectBarInCard(canvasElement);
		await expect(joinButton(canvasElement)).toBeDisabled();
	}
};

export const NoTime1440: Story = {
	name: 'No fixed time · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="noTime" />,
	play: async ({ canvasElement }) => {
		await expectBarInCard(canvasElement);
		await expect(joinButton(canvasElement)).toBeDisabled();
	}
};

export const Open1440: Story = {
	name: 'Room open · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" variant="open" />,
	play: async ({ canvasElement }) => {
		await expectBarInCard(canvasElement);
		await waitFor(() => expect(joinButton(canvasElement)).toBeEnabled());
	}
};
