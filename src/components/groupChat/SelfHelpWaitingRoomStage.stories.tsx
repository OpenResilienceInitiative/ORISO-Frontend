import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { JoinGroupChatView } from './JoinGroupChatView';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
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
import {
	expectCaptionClear,
	expectOverdueClockOnOneRow
} from './waitingClock/waitingClockStoryChecks';
import './joinChat.styles';
import { expectWaitingRoomLayout } from '../app/registrationLoader/waitingRoomLayoutContract';
import {
	effectiveBackground,
	wcagContrast
} from '../../utils/theme/wcagContrast';

/**
 * #1499 item 1 — the counsellor's view of a self-help group ("Gesprächskreis")
 * before it starts, in the stage the app gives it: rail, list column with the
 * group's row, and the white chat card with the waiting room and "Chat
 * starten".
 *
 * Since #1689 it is the same `GroupWaitingRoom` the advice seeker sees in the
 * card and behind the group link — her own words on the clock, "Chat starten"
 * in the bar, no consent — so the shared waiting-room contract holds here too.
 */

const OVERDUE_SECONDS = -252;
/* #1499 bug A: past 99 minutes the minutes group needs a third digit cell.
   On Dev every freshly created group is there within minutes, because
   UserService stores the start two hours early. */
const OVERDUE_3_DIGIT_SECONDS = -(140 * 60 + 7);
const FUTURE_SECONDS = 2 * 86400 + 3 * 3600 + 21 * 60 + 50;

const desktop1280Globals = { viewport: { value: 'desktop1280' } };

const Stage = ({
	layout,
	deltaSeconds
}: {
	layout: 'desktop' | 'mobile';
	deltaSeconds: number;
}) => {
	const listItem = React.useMemo(
		() => buildGroupStageListItem(deltaSeconds),
		[deltaSeconds]
	);
	return (
		<GroupChatStage listItem={listItem} layout={layout}>
			<JoinGroupChatView />
		</GroupChatStage>
	);
};

/**
 * The shared waiting-room contract in its chat-card form, and the
 * moderator's own bar: "Chat starten" live before the group opens, no
 * "Beitreten" and no consent sheet (#1689).
 */
const assertCentred = async (canvasElement: HTMLElement) => {
	await waitFor(() =>
		expect(
			canvasElement.querySelector('[data-cy="group-entry-room"]')
		).not.toBeNull()
	);
	await expectWaitingRoomLayout(canvasElement, { frame: 'card' });
	const start = within(canvasElement).getByRole('button', {
		name: 'Chat starten'
	});
	await expect(start).toBeEnabled();
	await expect(
		within(canvasElement).queryByRole('button', { name: 'Beitreten' })
	).toBeNull();
	await expect(within(canvasElement).queryByRole('checkbox')).toBeNull();
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
					'#1499 item 1 — the self-help group before its start, as the counsellor sees it in the app. Since #1689 the same `GroupWaitingRoom` as the advice seeker: clock with the moderator\'s words in the white chat card, "Chat starten" in the bar.'
			}
		}
	}
} satisfies Meta;

export default meta;

/* "Chat-Info" is now labelled "Informationen & Einstellungen" (#1465). */
const CHAT_INFO = /Informationen & Einstellungen/;

/* The session menu renders through a portal into the body (#1465). */
const menuOf = (canvasElement: HTMLElement) =>
	canvasElement.ownerDocument.querySelector<HTMLElement>('#flyout')!;
type Story = StoryObj<typeof meta>;

/** Frank's case: 1440, start time just passed (the counting-up clock). */
export const Overdue1440: Story = {
	name: 'Overdue · 1440',
	globals: desktop1440Globals,
	render: () => <Stage layout="desktop" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvasElement, canvas }) => {
		await assertCentred(canvasElement);
		await expectOverdueClockOnOneRow(canvasElement);
		await expectCaptionClear(canvasElement);
		await expect(
			canvas.getByRole('button', { name: 'Chat starten' })
		).toBeVisible();
		// #1760: no text link in the header; Chat-Info sits in the ⋮ menu.
		await expect(
			canvas.queryByRole('link', { name: CHAT_INFO })
		).toBeNull();
		const menuButton = canvasElement.querySelector<HTMLElement>('#iconH');
		await expect(menuButton).toBeVisible();
		await userEvent.click(menuButton!);
		const menu = within(menuOf(canvasElement));
		await waitFor(() =>
			expect(menu.getByRole('link', { name: CHAT_INFO })).toBeVisible()
		);
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
		await expectOverdueClockOnOneRow(canvasElement);
		await expectCaptionClear(canvasElement);
		await expect(
			canvas.getByRole('button', { name: 'Chat starten' })
		).toBeVisible();
	}
};

/**
 * #1499 bug A on the counsellor's side: the same group 140 minutes late. The
 * minutes group draws three digits, minutes and seconds stay on one row, and
 * the caption below stays clear.
 */
export const Overdue3Digits1440: Story = {
	name: 'Overdue 140 min · 1440',
	globals: desktop1440Globals,
	render: () => (
		<Stage layout="desktop" deltaSeconds={OVERDUE_3_DIGIT_SECONDS} />
	),
	play: async ({ canvasElement }) => {
		await assertCentred(canvasElement);
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
	}
};

export const Overdue3Digits390: Story = {
	name: 'Overdue 140 min · 390 mobile',
	globals: phone390Globals,
	render: () => (
		<Stage layout="mobile" deltaSeconds={OVERDUE_3_DIGIT_SECONDS} />
	),
	play: async ({ canvasElement }) => {
		await assertCentred(canvasElement);
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
	}
};

/**
 * Dev test of #1499: on a phone the waiting room had no way into Chat-Info,
 * so the co-moderator help ("Chat-Info → Chatraum Einstellungen →
 * Bearbeiten") was a dead end. The header now carries the same ⋮ menu as
 * every other chat; "Chat beenden" stays out until the group runs.
 */
export const ChatInfoMenu390: Story = {
	name: 'Chat-Info menu · 390 mobile',
	globals: phone390Globals,
	render: () => <Stage layout="mobile" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvasElement }) => {
		const menuButton = canvasElement.querySelector<HTMLElement>('#iconV');
		await expect(menuButton).not.toBeNull();
		await expect(menuButton!).toBeVisible();
		await userEvent.click(menuButton!);
		const menu = within(menuOf(canvasElement));
		await waitFor(() =>
			expect(menu.getByRole('link', { name: CHAT_INFO })).toBeVisible()
		);
		await expect(menu.queryByText('Chat beenden')).toBeNull();
	}
};

/**
 * Review of #1782: a counsellor who comes into a group that already runs is
 * staff, not a client. "Beitreten" takes her in without the clients'
 * consent sheet — she agreed to the documents with her contract.
 */
const OpenGroupStage = () => {
	const listItem = React.useMemo(() => {
		const item = buildGroupStageListItem(-15 * 60);
		return {
			...item,
			chat: { ...item.chat, active: true, subscribed: false }
		} as typeof item;
	}, []);
	return (
		<GroupChatStage listItem={listItem} layout="desktop">
			<JoinGroupChatView />
		</GroupChatStage>
	);
};

export const StaffJoinsOpenGroup1440: Story = {
	name: 'Staff joins a running group · no consent · 1440',
	globals: desktop1440Globals,
	render: () => <OpenGroupStage />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="group-entry-room"]')
			).not.toBeNull()
		);
		// #1787: the group runs, so no "starts soon"; the calm clock says
		// how long it has run, and staff are the moderation themselves.
		await expect(
			canvas.getByText(/^Die Gruppe hat .*begonnen\.$/)
		).toBeVisible();
		await expect(canvas.getByText('Läuft gerade')).toBeVisible();
		await expect(canvas.queryByText('Die Gruppe wartet.')).toBeNull();
		const join = canvas.getByTestId('group-entry-join');
		await expect(join).toBeEnabled();
		// The join goes out directly: a PUT on the group's /join, no
		// consent written to the account on the way.
		const requests: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url = String(input instanceof Request ? input.url : input);
			// `fetchData` passes a Request, which carries the method.
			const method = (
				init?.method ??
				(input instanceof Request ? input.method : 'GET')
			).toUpperCase();
			if (method !== 'GET') requests.push(`${method} ${url}`);
			if (method === 'PUT' && /\/join$/.test(url)) {
				return new Response(null, { status: 200 });
			}
			return originalFetch(input, init);
		};
		try {
			await userEvent.click(join);
			await waitFor(() =>
				expect(requests.some((r) => /^PUT .*\/join$/.test(r))).toBe(
					true
				)
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
		await expect(requests.some((r) => /users\/data/.test(r))).toBe(false);
		await expect(canvas.queryByRole('checkbox')).toBeNull();
		await expect(canvas.queryByText('Bevor Sie schreiben')).toBeNull();
	}
};

/** The same group once it runs: header with the ⋮ menu and its Chat-Info row. */
const RunningStage = ({ layout }: { layout: 'desktop' | 'mobile' }) => {
	const stopOrLeaveRef = React.useRef(false);
	const listItem = React.useMemo(() => {
		const item = buildGroupStageListItem(-15 * 60);
		return {
			...item,
			chat: { ...item.chat, active: true, subscribed: true }
		} as typeof item;
	}, []);
	return (
		<GroupChatStage listItem={listItem} layout={layout}>
			<div className="session">
				<SessionHeaderComponent
					isJoinGroupChatView={false}
					bannedUsers={[]}
					hasUserInitiatedStopOrLeaveRequest={stopOrLeaveRef}
				/>
				<div className="session__content" />
			</div>
		</GroupChatStage>
	);
};

export const RunningChatInfoMenu390: Story = {
	name: 'Running · Chat-Info menu · 390 mobile',
	globals: phone390Globals,
	render: () => <RunningStage layout="mobile" />,
	play: async ({ canvasElement }) => {
		const menuButton = canvasElement.querySelector<HTMLElement>('#iconV');
		await expect(menuButton).not.toBeNull();
		await userEvent.click(menuButton!);
		const menu = within(menuOf(canvasElement));
		await waitFor(() =>
			expect(menu.getByRole('link', { name: CHAT_INFO })).toBeVisible()
		);
	}
};

/**
 * Dev test of #1499 with Träger 2's light-blue brand colour (#b4ddee): the
 * filled "Chat starten" keeps the Träger's pastel with a dark on-primary
 * label on top (Frank: no dark re-colouring of filled areas).
 */
export const LightBrandColour390: Story = {
	name: 'Light brand colour (Träger 2) · 390 mobile',
	globals: phone390Globals,
	parameters: { orisoSeed: '#b4ddee' },
	render: () => <Stage layout="mobile" deltaSeconds={OVERDUE_SECONDS} />,
	play: async ({ canvas }) => {
		const start = canvas.getByRole('button', { name: 'Chat starten' });
		await waitFor(() =>
			expect(
				wcagContrast(
					getComputedStyle(start).color,
					effectiveBackground(start)
				)
			).toBeGreaterThanOrEqual(4.5)
		);
		await expect(getComputedStyle(start).backgroundColor).toBe(
			'rgb(180, 221, 238)'
		);
	}
};
