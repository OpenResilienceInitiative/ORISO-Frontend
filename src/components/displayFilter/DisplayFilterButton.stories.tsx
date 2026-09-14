import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { DisplayFilterButton } from './DisplayFilterButton';
import { ORISO_M3_FIGMA_URL } from '../storybookDesignLinks';
import '../sessionsList/sessionsList.styles.scss';

/**
 * Entry point to the display filter (#1377, spec §3): an icon-only pill with
 * the `tune` glyph and a dot while the section's filter is customised.
 */
const meta = {
	title: 'Molecules/DisplayFilterButton',
	component: DisplayFilterButton,
	tags: ['autodocs'],
	parameters: {
		design: { type: 'figma', url: ORISO_M3_FIGMA_URL }
	},
	args: {
		label: 'Anzeige-Filter',
		customisedLabel: 'Filter angepasst',
		customised: false,
		open: false,
		onClick: () => undefined
	},
	decorators: [
		(Story) => (
			<div className="sessionsListToolbar" style={{ padding: 16 }}>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof DisplayFilterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The dot says "this list is filtered" without adding a chip to the row. */
export const Customised: Story = {
	args: { customised: true },
	play: async ({ canvasElement }) => {
		const button = within(canvasElement).getByRole('button', {
			name: 'Anzeige-Filter'
		});
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await expect(
			button.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	}
};

export const DialogOpen: Story = {
	args: { open: true, customised: true }
};
