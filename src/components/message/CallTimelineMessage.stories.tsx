import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { CallTimelineMessage } from './CallTimelineMessage';
import {
	withMessageShell,
	type MessageStoryParameters
} from './messageStoryShell';
import './message.styles.scss';

const meta = {
	title: 'Components/Chat/CallTimelineMessage',
	component: CallTimelineMessage,
	tags: ['autodocs'],
	decorators: [
		(Story, context) =>
			withMessageShell(Story, {
				parameters: context.parameters as MessageStoryParameters
			})
	],
	args: {
		call: {
			callId: 'call-story',
			roomRef: '!conversation:example',
			callRoomId: '!media:example',
			state: 'ended',
			callType: 'video',
			durationSeconds: 125,
			participants: [
				{ userId: '@alex:example', displayName: 'Alex Test' },
				{ userId: '@sam:example', displayName: 'Sam Test' }
			]
		}
	}
} satisfies Meta<typeof CallTimelineMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ended: Story = {
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Videoanruf: Beendet|Video call: Ended/
				})
			).toBeVisible()
		);
		await expect(canvas.getByText(/02:05/)).toBeVisible();
	}
};
export const AudioEnded: Story = {
	args: { call: { ...meta.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Audioanruf: Beendet|Audio call: Ended/
				})
			).toBeVisible()
		);
	}
};
export const Missed: Story = {
	args: {
		call: {
			...meta.args.call,
			state: 'missed',
			// As a real missed call is written: the caller is its only
			// participant (#780 walkthrough: the card said "Attended · 1").
			actorUserId: '@alex:example',
			participants: [
				{ userId: '@alex:example', displayName: 'Alex Test' }
			],
			durationSeconds: undefined
		}
	},
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Videoanruf: Verpasst|Video call: Missed/
				})
			).toBeVisible()
		);
		await expect(canvas.queryByText(/02:05/)).toBeNull();
		await expect(canvas.queryByText(/Teilgenommen|Attended/)).toBeNull();
		await expect(canvas.getByText(/Alex Test/)).toBeVisible();
	}
};
export const AudioMissed: Story = {
	args: { call: { ...Missed.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Audioanruf: Verpasst|Audio call: Missed/
				})
			).toBeVisible()
		);
	}
};
export const Running: Story = {
	args: {
		onJoin: fn(async () => 'joined' as const),
		call: {
			...meta.args.call,
			state: 'running',
			durationSeconds: undefined
		}
	},
	play: async ({ canvas, args }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Videoanruf: Läuft|Video call: In progress/
				})
			).toBeVisible()
		);
		await userEvent.click(
			canvas.getByRole('button', { name: /Beitreten|Join call/ })
		);
		await expect(args.onJoin).toHaveBeenCalledTimes(1);
	}
};
export const AudioRunning: Story = {
	args: { call: { ...Running.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Audioanruf: Läuft|Audio call: In progress/
				})
			).toBeVisible()
		);
	}
};

/**
 * Frank's Dev screenshot (#2237, checkpoint 4): a running group call. The
 * card carries the info glyph of a system message, not the Carimat robot,
 * and the people in the call are 40px faces without the heavy ring.
 */
export const RunningGroupCall: Story = {
	args: {
		onJoin: fn(async () => 'joined' as const),
		call: {
			...meta.args.call,
			state: 'running',
			durationSeconds: undefined,
			present: [
				{ userId: '@alex:example', displayName: 'Alex Test' },
				{ userId: '@sam:example', displayName: 'Sam Test' },
				{ userId: '@kim:example', displayName: 'Kim Test' }
			]
		}
	},
	play: async ({ canvas, canvasElement }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Videoanruf: Läuft|Video call: In progress/
				})
			).toBeVisible()
		);
		await expect(
			canvasElement.querySelector('.messageItem__avatar--system svg')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('.messageItem__botAvatarIcon')
		).toBeNull();
		const face = canvas.getByRole('img', { name: /Kim Test/ });
		// Measured once the card's entry animation has settled.
		await waitFor(() =>
			expect(Math.round(face.getBoundingClientRect().width)).toBe(40)
		);
		// Hovering a face names the person in the dark tooltip.
		await userEvent.hover(face);
		await waitFor(() =>
			expect(
				within(canvasElement.ownerDocument.body).getByRole('tooltip')
			).toHaveTextContent('Kim Test')
		);
		await userEvent.unhover(face);
	}
};

export const ReloadedEndedCall: Story = {
	args: {
		call: {
			...meta.args.call,
			state: 'running',
			durationSeconds: undefined
		},
		onJoin: fn(async () => 'joined' as const),
		loadState: async (call) => ({
			...call,
			state: 'ended',
			durationSeconds: 125
		})
	},
	play: async ({ canvas }) => {
		await waitFor(() =>
			expect(
				canvas.getByRole('status', {
					name: /Videoanruf: Beendet|Video call: Ended/
				})
			).toBeVisible()
		);
		await expect(canvas.getByText(/02:05/)).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /Beitreten|Join call/ })
		).toBeNull();
	}
};
