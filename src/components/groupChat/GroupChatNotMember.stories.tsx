import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { GroupChatNotMember, JoinRequestViewState } from './GroupChatNotMember';
import { createFakeJoinRequestTransport } from './joinRequest/fakeJoinRequestTransport';
import { useOwnJoinRequest } from './joinRequest/useOwnJoinRequest';
import { KNOCK_SERIES_ID } from './joinRequest/__storybook__/joinRequestFixtures';

/**
 * #1499. A counsellor follows a group's invite link and now lands in her own
 * session view, not the client's entry room. When the group belongs to
 * another Beratungsstelle the server refuses it (`GET /users/chat/<id>`
 * → 403); this is what she sees instead of someone else's moderator room.
 *
 * Item 14 (Frank, 23.09.2026): she may knock — "Beitritt anfragen" — and the
 * notice then follows her request until the moderation lets her in or not.
 * Nothing of the group itself shows here, not even its name.
 */
const meta = {
	title: 'Group chat/Not a member',
	component: GroupChatNotMember,
	args: { onBack: fn() },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Beraterin öffnet den Einladungslink eines Gesprächskreises, zu dem sie nicht gehört: klare Aussage, der Weg zurück zu ihren Gesprächen und — wo der Server es anbietet — „Beitritt anfragen" (ORISO-Frontend#1499, Punkt 14). Danach zeigt der Hinweis den Stand der Anfrage: gesendet (mit „Anfrage zurückziehen"), hereingelassen („Gesprächskreis öffnen") oder abgelehnt. Ohne Knock-Endpunkte im Backend bleibt es beim Hinweis aus #1534.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					height: '100vh',
					display: 'grid',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof GroupChatNotMember>;

export default meta;
type Story = StoryObj<typeof meta>;

const joinRequest = (state: JoinRequestViewState) => ({
	state,
	onRequest: fn(),
	onCancel: fn(),
	onOpenGroup: fn()
});

/** #1534: the server offers no knocking — statement and the way back. */
export const Desktop1440: Story = {
	name: 'Not a member · 1440',
	globals: desktop1440Globals,
	play: async ({ args, canvas }) => {
		await expect(
			canvas.getByText('Sie sind nicht Teil dieses Gesprächskreises.')
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Zu meinen Gesprächen' })
		);
		await expect(args.onBack).toHaveBeenCalledTimes(1);
	}
};

export const Phone390: Story = {
	name: 'Not a member · 390',
	globals: phone390Globals
};

export const AskToJoin1440: Story = {
	name: 'Knock · ask to join · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('idle') },
	play: async ({ args, canvas }) => {
		await expect(
			canvas.getByText(
				'Sie können die Moderation bitten, Sie hereinzulassen. Bis dahin sehen Sie nichts aus diesem Gesprächskreis.'
			)
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Beitritt anfragen' })
		);
		await expect(args.joinRequest!.onRequest).toHaveBeenCalledTimes(1);
	}
};

export const AskToJoin390: Story = {
	name: 'Knock · ask to join · 390',
	globals: phone390Globals,
	args: { joinRequest: joinRequest('idle') }
};

export const RequestSent1440: Story = {
	name: 'Knock · request sent · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('pending') },
	play: async ({ args, canvas }) => {
		await expect(
			canvas.getByText(
				'Anfrage gesendet – die Moderation wird benachrichtigt.'
			)
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anfrage zurückziehen' })
		);
		await expect(args.joinRequest!.onCancel).toHaveBeenCalledTimes(1);
	}
};

export const RequestSent390: Story = {
	name: 'Knock · request sent · 390',
	globals: phone390Globals,
	args: { joinRequest: joinRequest('pending') }
};

export const Admitted1440: Story = {
	name: 'Knock · let in · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('admitted') },
	play: async ({ args, canvas }) => {
		await userEvent.click(
			canvas.getByRole('button', { name: 'Gesprächskreis öffnen' })
		);
		await expect(args.joinRequest!.onOpenGroup).toHaveBeenCalledTimes(1);
	}
};

export const Declined1440: Story = {
	name: 'Knock · declined · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('declined') },
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText('Diesmal hat es nicht geklappt.')
		).toBeVisible();
		await expect(canvas.getAllByRole('button')).toHaveLength(1);
	}
};

export const SendFailed1440: Story = {
	name: 'Knock · sending failed · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('error') },
	play: async ({ canvas }) => {
		await expect(canvas.getByRole('alert')).toHaveTextContent(
			'Die Anfrage konnte nicht gesendet werden.'
		);
	}
};

/** The server refused the link's token (403): no retry, only the way back. */
export const LinkInvalid1440: Story = {
	name: 'Knock · link no longer valid · 1440',
	globals: desktop1440Globals,
	args: { joinRequest: joinRequest('linkInvalid') },
	play: async ({ canvas }) => {
		await expect(canvas.getByRole('alert')).toHaveTextContent(
			'Dieser Einladungslink ist nicht mehr gültig. Bitte fragen Sie die Moderation nach einem neuen Link.'
		);
		await expect(canvas.getAllByRole('button')).toHaveLength(1);
	}
};

export const LinkInvalid390: Story = {
	name: 'Knock · link no longer valid · 390',
	globals: phone390Globals,
	args: { joinRequest: joinRequest('linkInvalid') }
};

/** In-memory server for the wired flow; reset before each run. */
const knockFlowTransport = createFakeJoinRequestTransport({ latencyMs: 150 });

/**
 * The whole knock, wired through `useOwnJoinRequest` against the in-memory
 * transport: ask, see "sent", the moderation lets her in.
 */
export const KnockFlow: Story = {
	name: 'Knock · flow (wired) · 1440',
	globals: desktop1440Globals,
	beforeEach: () => {
		knockFlowTransport.setMine(KNOCK_SERIES_ID, null);
	},
	render: function KnockFlowStory(args) {
		const request = useOwnJoinRequest(
			KNOCK_SERIES_ID,
			'sb-invite-token',
			knockFlowTransport,
			{
				onOpenGroup: args.onBack
			}
		);
		return (
			<GroupChatNotMember onBack={args.onBack} joinRequest={request} />
		);
	},
	play: async ({ canvas }) => {
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Beitritt anfragen' })
		);
		await canvas.findByText(
			'Anfrage gesendet – die Moderation wird benachrichtigt.'
		);

		knockFlowTransport.setMine(KNOCK_SERIES_ID, {
			id: 1,
			status: 'ADMITTED',
			requestedAt: new Date().toISOString()
		});

		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Gesprächskreis öffnen' })
			).toBeVisible()
		);
	}
};
