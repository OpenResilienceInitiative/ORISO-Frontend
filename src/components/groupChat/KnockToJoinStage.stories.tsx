import * as React from 'react';
import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { JoinGroupChatView } from './JoinGroupChatView';
import {
	buildGroupStageListItem,
	GROUP_STAGE_CHAT_ID,
	GROUP_STAGE_ROOM_ID,
	groupStageConsultant,
	GroupChatStage
} from './groupChatStageStoryShell';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { MessageItemComponent } from '../message/MessageItemComponent';
import { mockMessageItemComponentProps } from '../message/MessageItemComponent.mocks';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import { JoinRequestCenter } from './joinRequest/JoinRequestCenter';
import { createFakeJoinRequestTransport } from './joinRequest/fakeJoinRequestTransport';
import {
	fourKnocking,
	KNOCK_STORY_NOW
} from './joinRequest/__storybook__/joinRequestFixtures';
import type { GroupChatModeratorRole } from './joinRequest/joinRequestModel';
import type { ListItemInterface } from '../../globalState/interfaces';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import './joinChat.styles';
import '../message/message.styles.scss';
import '../sessionHeader/sessionHeader.styles.scss';

/**
 * #1499 item 14 — the moderator's side of knocking, on the stage the app
 * gives it: four colleagues knock within ten minutes while she is in the
 * group's waiting room, or in the middle of the running group.
 *
 * Everything that is not fixture is production: the stage (rail, list column,
 * chat card / bottom navigation), `JoinGroupChatView`, the session header and
 * message rows, the snackbar host, `JoinRequestCenter` and its popup. Only
 * the server is played by `createFakeJoinRequestTransport`.
 */

const runningListItem = (): ListItemInterface => {
	const item = buildGroupStageListItem(-40 * 60);
	return {
		...item,
		chat: { ...item.chat, active: true, lastMessage: 'Danke euch allen.' }
	} as ListItemInterface;
};

const runningMessages = [
	{
		_id: 'm1',
		displayName: 'sanftes Alpaka Mika',
		message:
			'Ich habe mich diese Woche zum ersten Mal getraut, es meiner Schwester zu erzählen.'
	},
	{
		_id: 'm2',
		displayName: 'ruhiges Yak Kim',
		message: 'Wie hat sie reagiert? Bei mir hat das lange gedauert.'
	},
	{
		_id: 'm3',
		displayName: groupStageConsultant.displayName,
		isMyMessage: true,
		userId: '@consultant-storybook:oriso.invalid',
		message:
			'Danke, dass du das teilst, Mika. Magst du erzählen, was dir dabei geholfen hat?'
	},
	{
		_id: 'm4',
		displayName: 'sanftes Alpaka Mika',
		message: 'Ehrlich gesagt: diese Gruppe. Danke euch allen.'
	}
];

const RunningGroupChat = () => (
	<div className="session">
		<SessionHeaderComponent isJoinGroupChatView={false} bannedUsers={[]} />
		<div
			className="session__content"
			style={{ overflowY: 'auto', padding: '16px 16px 24px' }}
		>
			{runningMessages.map((message, index) => (
				<MessageItemComponent
					key={message._id}
					{...mockMessageItemComponentProps({
						userId: `@member-${index}:oriso.invalid`,
						username: message.displayName,
						rid: GROUP_STAGE_ROOM_ID,
						isMyMessage: false,
						// One "Heute" divider above the first message only.
						messageDate: {
							str: index === 0 ? 'Heute' : '',
							date: null
						},
						...message
					})}
				/>
			))}
		</div>
	</div>
);

const KnockStage = ({
	layout,
	background,
	viewerRole = 'OWNER'
}: {
	layout: 'desktop' | 'mobile';
	background: 'waitingRoom' | 'running';
	viewerRole?: GroupChatModeratorRole;
}) => {
	const stack = useMemo(() => createSnackbarStack(), []);
	const transport = useMemo(() => {
		const fake = createFakeJoinRequestTransport({ latencyMs: 250 });
		fake.setPending(fourKnocking(viewerRole));
		return fake;
	}, [viewerRole]);
	const listItem = useMemo(
		() =>
			background === 'waitingRoom'
				? buildGroupStageListItem(-252)
				: runningListItem(),
		[background]
	);
	return (
		<>
			<GroupChatStage listItem={listItem} layout={layout}>
				{background === 'waitingRoom' ? (
					<JoinGroupChatView />
				) : (
					<RunningGroupChat />
				)}
			</GroupChatStage>
			<M3SnackbarHost stack={stack} />
			<JoinRequestCenter
				transport={transport}
				stack={stack}
				now={KNOCK_STORY_NOW}
			/>
		</>
	);
};

const body = () => within(document.body);
const cards = () => body().queryAllByTestId('join-request-snackbar');
const names = () =>
	cards().map(
		(card) => card.querySelector('p')?.textContent ?? card.textContent
	);

const meta = {
	title: 'Group chat/Knock to join (stage)',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: `/sessions/consultant/sessionView/${GROUP_STAGE_ROOM_ID}/${GROUP_STAGE_CHAT_ID}`
		},
		docs: {
			description: {
				component:
					'#1499 Punkt 14 — vier Kolleg:innen klopfen innerhalb von zehn Minuten, während die Moderatorin im Warteraum ihres Gesprächskreises ist oder mitten im laufenden Gespräch. Snackbars stapeln sich unten links über der Listenspalte (Handy: über der Navigationsleiste), die älteste Anfrage oben; über drei (Handy: zwei) klappen die ältesten in „+N weitere anzeigen". Reinlassen/Ablehnen direkt oder über „Details" im Popup.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WaitingRoom1440: Story = {
	name: 'Waiting room · 4 knocking · 1440',
	globals: desktop1440Globals,
	render: () => <KnockStage layout="desktop" background="waitingRoom" />,
	play: async () => {
		// Newest three visible, oldest (Anna) folded into "+1".
		await waitFor(() => expect(cards()).toHaveLength(3), { timeout: 5000 });
		await expect(names()).toEqual([
			'Jonas Keller',
			'Mira Sommer',
			'Yusuf Demir-Hoffmann'
		]);
		await expect(
			body().getByRole('button', { name: '1 weitere anzeigen' })
		).toBeVisible();
		// The stack sits over the list column, clear of the chat card.
		const region = body().getByRole('region', {
			name: 'Benachrichtigungen'
		});
		await expect(region.getBoundingClientRect().right).toBeLessThanOrEqual(
			85 + 400
		);
	}
};

export const WaitingRoom390: Story = {
	name: 'Waiting room · 4 knocking · 390',
	globals: phone390Globals,
	render: () => <KnockStage layout="mobile" background="waitingRoom" />,
	play: async () => {
		await waitFor(() => expect(cards()).toHaveLength(2), { timeout: 5000 });
		await expect(
			body().getByRole('button', { name: '2 weitere anzeigen' })
		).toBeVisible();
		const nav = document.querySelector('.groupStage__bottomNav');
		await waitFor(() => {
			const newest = cards()[cards().length - 1].getBoundingClientRect();
			expect(newest.bottom).toBeLessThanOrEqual(
				nav!.getBoundingClientRect().top
			);
		});
	}
};

export const RunningGroup1440: Story = {
	name: 'Running group · 4 knocking · 1440',
	globals: desktop1440Globals,
	render: () => <KnockStage layout="desktop" background="running" />,
	play: async () => {
		await waitFor(() => expect(cards()).toHaveLength(3), { timeout: 5000 });
	}
};

export const RunningGroup390: Story = {
	name: 'Running group · 4 knocking · 390',
	globals: phone390Globals,
	render: () => <KnockStage layout="mobile" background="running" />,
	play: async () => {
		await waitFor(() => expect(cards()).toHaveLength(2), { timeout: 5000 });
	}
};

/** Let the newest in, decline the next; the folded one moves up. */
export const AdmitAndDecline1440: Story = {
	name: 'Flow · admit, decline, expand · 1440',
	globals: desktop1440Globals,
	render: () => <KnockStage layout="desktop" background="running" />,
	play: async () => {
		await waitFor(() => expect(cards()).toHaveLength(3), { timeout: 5000 });
		const yusuf = body().getByRole('group', {
			name: 'Yusuf Demir-Hoffmann'
		});
		await userEvent.click(
			within(yusuf).getByRole('button', { name: 'Reinlassen' })
		);
		await body().findByText(
			'Yusuf Demir-Hoffmann ist jetzt im Gesprächskreis.',
			{ selector: '.MuiAlert-message' }
		);
		const mira = body().getByRole('group', { name: 'Mira Sommer' });
		await userEvent.click(
			within(mira).getByRole('button', { name: 'Ablehnen' })
		);
		await body().findByText('Anfrage von Mira Sommer abgelehnt.', {
			selector: '.MuiAlert-message'
		});
		// Two confirmations now sit at the bottom edge; with three places the
		// oldest open request (Anna) folds into "+1" until they time out.
		await waitFor(() => expect(names()).toEqual(['Jonas Keller']));
		await userEvent.click(
			body().getByRole('button', { name: '1 weitere anzeigen' })
		);
		await expect(names()).toEqual(['Anna Berg', 'Jonas Keller']);
	}
};

/** A co-moderator opens the details: co-moderation is shown but disabled. */
export const CoModeratorDetails1440: Story = {
	name: 'Flow · co-moderator opens details · 1440',
	globals: desktop1440Globals,
	render: () => (
		<KnockStage
			layout="desktop"
			background="waitingRoom"
			viewerRole="CO_MODERATOR"
		/>
	),
	play: async () => {
		await waitFor(() => expect(cards()).toHaveLength(3), { timeout: 5000 });
		const jonas = body().getByRole('group', { name: 'Jonas Keller' });
		await userEvent.click(
			within(jonas).getByRole('button', { name: 'Details' })
		);
		const dialog = await body().findByRole('dialog', {
			name: 'Jonas Keller möchte dazukommen'
		});
		await expect(
			within(dialog).getByRole('radio', { name: 'Co-Moderation' })
		).toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
		await expect(cards()).toHaveLength(3);
	}
};
