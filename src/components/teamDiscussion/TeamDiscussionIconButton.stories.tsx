/**
 * The team-discussion marker on an enquiry list row: one clickable icon
 * instead of the former "Team discussion" text chip.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TeamDiscussionIconButton } from './TeamDiscussionBadge';

const meta: Meta<typeof TeamDiscussionIconButton> = {
	title: 'Team discussion/Icon button',
	component: TeamDiscussionIconButton,
	args: { onOpen: fn() }
};
export default meta;

type Story = StoryObj<typeof TeamDiscussionIconButton>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole('button', {
			name: /team/i
		});
		await userEvent.click(button);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
	}
};

export const Disabled: Story = {
	args: { onOpen: undefined }
};
