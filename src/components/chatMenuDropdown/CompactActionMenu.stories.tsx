import React from 'react';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { CompactActionMenu } from './CompactActionMenu';
import { ChatMenuDropdownItem } from './ChatMenuDropdown';

const meta = {
	title: 'Menus/CompactActionMenu',
	component: CompactActionMenu,
	args: {
		label: 'Aktionen für Alex',
		children: (close: () => void) => (
			<ChatMenuDropdownItem title="Person entfernen" onClick={close} />
		)
	},
	parameters: { layout: 'centered' }
} satisfies Meta<typeof CompactActionMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ParticipantActions: Story = {
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole('button', {
			name: 'Aktionen für Alex'
		});
		await userEvent.click(trigger);
		const body = within(canvasElement.ownerDocument.body);
		const action = await body.findByRole('button', {
			name: 'Person entfernen'
		});
		await waitFor(() => expect(action).toHaveFocus());
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(trigger).toHaveFocus());
		await userEvent.click(trigger);
		await userEvent.click(
			await body.findByRole('button', { name: 'Person entfernen' })
		);
		await waitFor(() =>
			expect(body.queryByRole('dialog')).not.toBeInTheDocument()
		);
	}
};

export const InsideDialog: Story = {
	render: (args) => (
		<M3Dialog open title="Teilnehmende" onClose={() => {}}>
			<CompactActionMenu {...args} />
		</M3Dialog>
	),
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await waitFor(() =>
			expect(
				body.getByRole('dialog', { name: 'Teilnehmende' })
			).toBeVisible()
		);
		const trigger = body.getByRole('button', { name: 'Aktionen für Alex' });
		await userEvent.click(trigger);
		await waitFor(() =>
			expect(
				body.getByRole('button', { name: 'Person entfernen' })
			).toHaveFocus()
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(trigger).toHaveFocus());
		expect(
			body.getByRole('dialog', { name: 'Teilnehmende' })
		).toBeVisible();
		await userEvent.click(trigger);
		const action = await body.findByRole('button', {
			name: 'Person entfernen'
		});
		const popup = action.closest('.MuiPopover-root');
		if (!popup) throw new Error('Missing popover');
		await userEvent.click(popup);
		await waitFor(() => expect(trigger).toHaveFocus());
		expect(
			body.queryByRole('button', { name: 'Person entfernen' })
		).not.toBeInTheDocument();
		expect(
			body.getByRole('dialog', { name: 'Teilnehmende' })
		).toBeVisible();
	}
};
