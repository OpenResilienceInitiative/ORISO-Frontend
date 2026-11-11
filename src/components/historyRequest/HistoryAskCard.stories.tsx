import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { HistoryAskCard } from './HistoryAskCard';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The person's side: after signing in on a new device the earlier messages are
 * locked. They write what the conversation was about and ask their counsellor
 * to release it.
 */
const meta = {
	title: 'Components/Chat/HistoryRequest/Ask',
	component: HistoryAskCard,
	parameters: { layout: 'padded' },
	args: { roomId: '!room:example.org', send: fn(async () => true) }
} satisfies Meta<typeof HistoryAskCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

export const Idle: Story = {};

export const DialogSendsRequest: Story = {
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			within(canvasElement).getByTestId('history-ask-open')
		);
		const send = await body().findByTestId('history-ask-send');
		await expect(send).toBeDisabled();
		await userEvent.type(
			await body().findByRole('textbox'),
			'It was about my exam anxiety.'
		);
		await userEvent.click(send);
		await waitFor(() =>
			expect(args.send).toHaveBeenCalledWith(
				'!room:example.org',
				'It was about my exam anxiety.'
			)
		);
	}
};

export const Waiting: Story = { args: { initialState: 'waiting' } };

export const Failed: Story = {
	args: {
		initialOpen: true,
		initialState: 'failed',
		send: fn(async () => false)
	}
};

export const Mobile: Story = {
	globals: phone390Globals,
	args: { initialOpen: true }
};
