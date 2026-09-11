import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
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

export const VideoEnded: Story = {
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(/Videoanruf beendet|Video call ended/)
		).toBeVisible();
		await expect(canvas.getByText(/02:05/)).toBeVisible();
	}
};
export const AudioEnded: Story = {
	args: { call: { ...meta.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(/Audioanruf beendet|Audio call ended/)
		).toBeVisible();
	}
};
export const VideoMissed: Story = {
	args: {
		call: {
			...meta.args.call,
			state: 'missed',
			participants: [],
			durationSeconds: undefined
		}
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(/Verpasster Videoanruf|Missed video call/)
		).toBeVisible();
		await expect(canvas.queryByText(/02:05/)).toBeNull();
	}
};
export const AudioMissed: Story = {
	args: { call: { ...VideoMissed.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(/Verpasster Audioanruf|Missed audio call/)
		).toBeVisible();
	}
};
export const VideoRunning: Story = {
	args: {
		onJoin: fn(async () => 'joined' as const),
		call: {
			...meta.args.call,
			state: 'running',
			durationSeconds: undefined
		}
	},
	play: async ({ canvas, args }) => {
		await expect(
			canvas.getByText(/Videoanruf läuft|Video call in progress/)
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: /Beitreten|Join call/ })
		);
		await expect(args.onJoin).toHaveBeenCalledTimes(1);
	}
};
export const AudioRunning: Story = {
	args: { call: { ...VideoRunning.args.call, callType: 'audio' } },
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(/Audioanruf läuft|Audio call in progress/)
		).toBeVisible();
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
		await expect(
			await canvas.findByText(/Videoanruf beendet|Video call ended/)
		).toBeVisible();
		await expect(canvas.getByText(/02:05/)).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /Beitreten|Join call/ })
		).toBeNull();
	}
};
