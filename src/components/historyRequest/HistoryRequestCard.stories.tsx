import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { HistoryRequestCard } from './HistoryRequestCard';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * A person signed in on a new device and cannot read the earlier messages.
 * They wrote a few words about the conversation; the counsellor reads them and
 * releases that one conversation, or declines. Nothing leaves the counsellor's
 * device before "Release".
 */
const meta = {
	title: 'Components/Chat/HistoryRequest/Card',
	component: HistoryRequestCard,
	parameters: { layout: 'padded' },
	args: {
		reason: 'It was about my exam anxiety and the plan we made in March.',
		requesterUserId: '@asker:example.org',
		requesterDeviceId: 'KXQ7PLM2',
		receivedAt: Date.UTC(2026, 9, 16, 9, 30),
		onApprove: fn(),
		onDecline: fn()
	}
} satisfies Meta<typeof HistoryRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', {
				name: /Release conversation|Gespräch freigeben/
			})
		);
		await expect(args.onApprove).toHaveBeenCalledTimes(1);
	}
};

export const Declining: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: /Decline|Ablehnen/ })
		);
		await expect(args.onDecline).toHaveBeenCalledTimes(1);
	}
};

export const Releasing: Story = {
	args: { busy: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('button', {
				name: /Release conversation|Gespräch freigeben/
			})
		).toBeDisabled();
	}
};

export const Failed: Story = {
	args: { failed: true },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole('alert')).toBeVisible();
	}
};

/** The longest reason the service accepts, with an unbroken word in it. */
export const LongReason: Story = {
	args: {
		reason: `${'We talked about many things. '.repeat(14)}${'x'.repeat(60)}`
	}
};

export const Mobile: Story = { globals: phone390Globals };
