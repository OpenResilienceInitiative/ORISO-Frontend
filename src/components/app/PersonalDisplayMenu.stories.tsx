import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PersonalDisplayControls } from '../../features/personal-display/PersonalDisplayEntry';
import { DEFAULT_DISPLAY } from '../../features/personal-display/preferences';

const meta = {
	title: 'App Shell/Personal Display',
	component: PersonalDisplayControls,
	parameters: { layout: 'centered' },
	args: { preferences: DEFAULT_DISPLAY, onChange: () => {} }
} satisfies Meta<typeof PersonalDisplayControls>;

export default meta;
type Story = StoryObj<typeof meta>;

const Interactive = ({ conversation = false }: { conversation?: boolean }) => {
	const [preferences, setPreferences] = useState(DEFAULT_DISPLAY);
	return (
		<PersonalDisplayControls
			preferences={preferences}
			onChange={setPreferences}
			placement={conversation ? 'conversation' : 'navigation'}
		/>
	);
};

export const Menu: Story = {
	globals: { locale: 'en' },
	render: () => <Interactive />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = await canvas.findByRole('button', { name: 'Display' });
		await userEvent.click(trigger);
		const dialog = within(
			await within(canvasElement.ownerDocument.body).findByRole(
				'dialog',
				{
					name: 'Display'
				}
			)
		);
		const scheme = within(
			dialog.getByRole('radiogroup', { name: 'Colour scheme' })
		);
		const contrast = within(
			dialog.getByRole('radiogroup', { name: 'Contrast' })
		);
		const system = scheme.getByRole('radio', { name: 'System' });
		const light = scheme.getByRole('radio', { name: 'Light' });
		const standard = contrast.getByRole('radio', { name: 'Standard' });
		const medium = contrast.getByRole('radio', { name: 'Medium' });

		await expect(system).toBeChecked();
		system.focus();
		await userEvent.keyboard('{ArrowRight}');
		await expect(light).toBeChecked();
		await expect(light).toHaveFocus();

		await userEvent.tab();
		await expect(standard).toHaveFocus();
		await userEvent.keyboard('{ArrowRight}');
		await expect(medium).toBeChecked();
		await expect(light).toBeChecked();

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(trigger).toHaveFocus());
	}
};

export const ConversationHeader: Story = {
	render: () => (
		<div className="contentWrapper--navInactive">
			<Interactive conversation />
		</div>
	)
};
