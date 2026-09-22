import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { JoinGroupChatView } from './JoinGroupChatView';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	GroupChatStage
} from './groupChatStageStoryShell';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import './joinChat.styles';

/**
 * #1499 item 1 — the counsellor's view of a self-help group ("Gesprächskreis")
 * before it starts, in the stage the app gives it: rail, list column with the
 * group's row, and the white chat card with the waiting room and "Chat
 * starten".
 *
 * Frank (21.09.2026): "bringe das design einer selbsthilfe gruppe ins zentrum
 * sonst ist es wie gerade abgeschnitten". Cause: the waiting room's content
 * carries the chat timeline's class `session__content`, which reserves
 * 240–344 px at the bottom for a composer the waiting room does not have. The
 * clock was pushed out of the centre and the panel scrolled. The fix lives in
 * `joinChat.styles.scss`; `Before fix` re-applies the old reserve so the two
 * can be compared side by side.
 */

const OVERDUE_SECONDS = -252;
const FUTURE_SECONDS = 2 * 86400 + 3 * 3600 + 21 * 60 + 50;

const desktop1280Globals = { viewport: { value: 'desktop1280' } };

/** Re-creates the pre-#1499 layout: composer reserve, top-aligned on phones. */
const BEFORE_FIX_CSS = `
	.groupStage--beforeFix .joinChat__content.session__content {
		justify-content: flex-start;
		padding: 16px 16px calc(var(--composer-dock-height, 240px) + 24px);
	}
	@media screen and (width <= 1366px) {
		.groupStage--beforeFix .joinChat__content.session__content {
			padding-bottom: calc(var(--composer-dock-height, 320px) + 24px);
		}
	}
	@media screen and (min-width: 900px) {
		.groupStage--beforeFix .joinChat__content.session__content {
			justify-content: center;
		}
	}
`;

const Stage = ({
	layout,
	deltaSeconds,
	beforeFix = false
}: {
	layout: 'desktop' | 'mobile';
	deltaSeconds: number;
	beforeFix?: boolean;
}) => {
	const listItem = React.useMemo(
		() => buildGroupStageListItem(deltaSeconds),
		[deltaSeconds]
	);
	return (
		<div className={beforeFix ? 'groupStage--beforeFix' : undefined}>
			{beforeFix && <style>{BEFORE_FIX_CSS}</style>}
			<GroupChatStage listItem={listItem} layout={layout}>
				<JoinGroupChatView />
			</GroupChatStage>
		</div>
	);
};

/**
 * The waiting-room block (heading, clock, caption, toggle, rules) must sit in
 * the middle of the free panel height and must not make the panel scroll.
 */
const assertCentred = async (canvasElement: HTMLElement) => {
	const panel =
		canvasElement.querySelector<HTMLElement>('.joinChat__content');
	await expect(panel).not.toBeNull();
	await waitFor(() =>
		expect(panel!.querySelector('.joinChat__waitingBox')).not.toBeNull()
	);
	const children = Array.from(panel!.children) as HTMLElement[];
	const panelRect = panel!.getBoundingClientRect();
	const top = Math.min(
		...children.map((child) => child.getBoundingClientRect().top)
	);
	const bottom = Math.max(
		...children.map((child) => child.getBoundingClientRect().bottom)
	);
	// Never above the panel's top edge — that part could not be scrolled to.
	await expect(top).toBeGreaterThanOrEqual(panelRect.top - 1);

	if (panel!.scrollHeight <= panel!.clientHeight + 1) {
		// Room to spare: the gap above equals the gap below (±16 px rounding).
		const gapAbove = top - panelRect.top;
		const gapBelow = panelRect.bottom - bottom;
		await expect(Math.abs(gapAbove - gapBelow)).toBeLessThanOrEqual(16);
	}
};

const meta = {
	title: 'Group chat/Self-help waiting room (stage)',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: `/sessions/consultant/sessionView/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
		},
		docs: {
			description: {
				component:
					'#1499 item 1 — the self-help group before its start, as the counsellor sees it in the app: the waiting room (clock, caption, animation switch, rules) centred in the white chat card, "Chat starten" at the bottom. Compare with `Before fix`.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Frank's case: 1440, start time just passed (the counting-up clock). */
export const Overdue1440: Story = {
	name: 'Overdue · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvasElement, canvas }) => {
		await assertCentred(canvasElement);
		await expect(
			canvas.getByRole('button', { name: 'Chat starten' })
		).toBeVisible();
	}
};

export const Overdue1280: Story = {
	name: 'Overdue · 1280',
	globals: desktop1280Globals,
	render: () => <Stage layout="desktop" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvasElement }) => {
		await assertCentred(canvasElement);
	}
};

/** Days ahead: the 2×2 countdown with the calendar action. */
export const Future1440: Story = {
	name: 'Future · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" deltaSeconds={FUTURE_SECONDS} />,
	play: async ({ canvasElement }) => {
		await assertCentred(canvasElement);
	}
};

/** Phone detail view with the M3 bottom navigation bar. */
export const Overdue390: Story = {
	name: 'Overdue · 390 mobile',
	globals: phone390Globals,
	render: () => <Stage layout="mobile" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvasElement, canvas }) => {
		await assertCentred(canvasElement);
		await expect(
			canvas.getByRole('button', { name: 'Chat starten' })
		).toBeVisible();
	}
};

/** The shipped layout before #1499, for comparison only. */
export const BeforeFix1440: Story = {
	name: 'Before fix · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Stage layout="desktop" deltaSeconds={OVERDUE_SECONDS} beforeFix />
	)
};
