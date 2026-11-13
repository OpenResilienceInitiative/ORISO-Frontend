import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Box } from '@mui/material';
import { GroupChatCalendarMenu } from './GroupChatCalendarMenu';

/**
 * The one calendar menu of every self-help group surface (waiting room, group
 * info, upcoming dates). Frank, 2026-11-12: the Google and Outlook copy
 * buttons were cut off at the menu's right edge; the play function keeps them
 * inside the menu.
 */
const meta = {
	title: 'Group chat/Calendar menu',
	component: GroupChatCalendarMenu,
	args: {
		start: new Date(Date.UTC(2026, 10, 20, 17, 0, 0)),
		durationMinutes: 90,
		eventId: 15
	},
	render: (args) => (
		<Box sx={{ p: 4 }}>
			<GroupChatCalendarMenu {...args} />
		</Box>
	)
} satisfies Meta<typeof GroupChatCalendarMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectCopyButtonsInsideTheMenu = async (canvasElement: HTMLElement) => {
	const body = within(canvasElement.ownerDocument.body);
	await userEvent.click(within(canvasElement).getByRole('button'));
	const menu = await body.findByRole('dialog');
	await waitFor(() => expect(menu).toBeVisible());
	const copyButtons = within(menu).getAllByRole('button', {
		name: /kopieren|copy/i
	});
	await expect(copyButtons.length).toBeGreaterThan(0);
	const edge = menu.getBoundingClientRect().right;
	for (const button of copyButtons) {
		await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
			edge
		);
	}
};

export const OpenOneDate: Story = {
	name: 'Open · one date · copy buttons inside the menu',
	play: async ({ canvasElement }) =>
		expectCopyButtonsInsideTheMenu(canvasElement)
};

export const OpenOneDatePhone: Story = {
	name: 'Open · one date · 390',
	parameters: { viewport: { defaultViewport: 'mobile1' } },
	play: async ({ canvasElement }) =>
		expectCopyButtonsInsideTheMenu(canvasElement)
};
