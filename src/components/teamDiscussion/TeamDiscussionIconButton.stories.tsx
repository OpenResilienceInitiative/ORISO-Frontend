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

/**
 * FE#2491: the same marker as a chip in the case header while the team chat
 * of the enquiry is on — the word written out, like supervision's people.
 */
export const HeaderChip: Story = {
	args: { showLabel: true, active: false },
	play: async ({ canvasElement, args }) => {
		const chip = within(canvasElement).getByRole('button', {
			name: /team/i
		});
		await expect(chip).toHaveAttribute('aria-pressed', 'false');
		await userEvent.click(chip);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
	}
};

/** The team chat panel is on screen: outlined, not colour alone. */
export const HeaderChipActive: Story = {
	args: { showLabel: true, active: true },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole('button', { name: /team/i })
		).toHaveAttribute('aria-pressed', 'true');
	}
};
