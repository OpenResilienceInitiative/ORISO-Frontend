/**
 * Participant avatar stack — the room header's "Avatar Group" (Figma
 * 1320:38281) built from the chat's `MessageAvatar` atom. T1 / T4 of the
 * 05.09. work list: hover or focus shows the name, the tail folds into "+N".
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ParticipantAvatarStack } from './ParticipantAvatarStack';
import type { StackParticipant } from './participantStack';

const ROOM_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

const client: StackParticipant = {
	userId: '@sonnenblume_47:oriso.invalid',
	username: 'sonnenblume_47',
	displayName: 'Sonnenblume_47',
	isAsker: true,
	lastActivity: 3
};
const counsellor: StackParticipant = {
	userId: '@mona.s:oriso.invalid',
	username: 'mona.s@oriso.invalid',
	displayName: 'Mona S.',
	firstName: 'Mona',
	lastName: 'Sommer',
	lastActivity: 2
};
const supervisor: StackParticipant = {
	userId: '@bettina.b:oriso.invalid',
	username: 'bettina.b@oriso.invalid',
	displayName: 'Bettina B.',
	firstName: 'Bettina',
	lastName: 'Berg',
	lastActivity: 1
};

const meta = {
	title: 'Components/Chat/ParticipantAvatarStack',
	component: ParticipantAvatarStack,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: ROOM_HEADER_FIGMA_URL }
	},
	decorators: [
		(Story) => (
			<div
				style={{
					padding: '16px 16px 48px',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof ParticipantAvatarStack>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Client (animal) + counsellor + supervisor (monograms), latest first. */
export const ThreeParticipants: Story = {
	name: 'Three participants — hover shows the name',
	args: { participants: [supervisor, counsellor, client] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(3);
		// Latest activity first: the client wrote last.
		await expect(avatars[0].getAttribute('data-user-id')).toBe(
			client.userId
		);
		// Tooltip hidden until hover …
		const tip = canvas.getByText('Mona S.', {
			selector: '[role="tooltip"]'
		});
		await expect(tip).not.toBeVisible();
		await userEvent.hover(avatars[1]);
		await waitFor(() => expect(tip).toBeVisible());
		await userEvent.unhover(avatars[1]);
		await waitFor(() => expect(tip).not.toBeVisible());
		// … and on keyboard focus.
		avatars[2].focus();
		await waitFor(() =>
			expect(
				canvas.getByText('Bettina B.', { selector: '[role="tooltip"]' })
			).toBeVisible()
		);
	}
};

/** Six people: four avatars and a "+2" chip (FE#1193 Job 2). */
export const OverflowPlusN: Story = {
	name: 'Six participants — "+2" fallback',
	args: {
		participants: [
			client,
			counsellor,
			supervisor,
			{ userId: '@kim:oriso.invalid', displayName: 'Kim G.' },
			{ userId: '@ali:oriso.invalid', displayName: 'Ali R.' },
			{ userId: '@jo:oriso.invalid', displayName: 'Jo L.' }
		]
	},
	play: async ({ canvasElement }) => {
		const avatars = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(4);
		const chip = canvasElement.querySelector<HTMLElement>(
			'[data-cy="participant-overflow"]'
		)!;
		await expect(chip.textContent).toBe('+2');
		// The chip is part of the flow: one 22 px step after the last avatar
		// and fully inside the stack's own box (nothing after the stack can
		// be painted over).
		const last = avatars[3].getBoundingClientRect();
		const chipRect = chip.getBoundingClientRect();
		const stack = canvasElement
			.querySelector('[data-cy="participant-stack"]')!
			.getBoundingClientRect();
		await expect(Math.round(chipRect.left - last.left)).toBe(22);
		await expect(chipRect.right).toBeLessThanOrEqual(stack.right + 0.5);
		await expect(getComputedStyle(chip).position).not.toBe('absolute');
	}
};

/** 40 px variant (Figma draws the header group at 40). */
export const Size40: Story = {
	args: { participants: [client, counsellor], size: 40 }
};
