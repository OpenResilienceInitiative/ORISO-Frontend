import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mui/material';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	AskerDisplayNameField,
	type AskerDisplayNameFieldProps
} from './AskerDisplayNameField';

const ControlledField = (args: AskerDisplayNameFieldProps) => {
	const [value, setValue] = React.useState(args.value);
	return (
		<Box sx={{ width: 360, maxWidth: '100%' }}>
			<AskerDisplayNameField
				{...args}
				value={value}
				onChange={(next) => {
					setValue(next);
					args.onChange(next);
				}}
			/>
		</Box>
	);
};
const meta = {
	title: 'Components/Form/Asker display name',
	component: AskerDisplayNameField,
	tags: ['autodocs'],
	parameters: { layout: 'centered' },
	args: { value: 'freundliche Katze Mika', editable: true, onChange: fn() },
	render: ControlledField
} satisfies Meta<typeof AskerDisplayNameField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
	play: async ({ canvasElement }) => {
		const input = within(canvasElement).getByRole('textbox');
		await userEvent.clear(input);
		await userEvent.type(input, 'My session alias');
		await expect(input).toHaveValue('My session alias');
	}
};
export const GeneratedOnly: Story = {
	args: { editable: false },
	play: async ({ canvasElement }) => {
		const input = within(canvasElement).getByRole('textbox');
		await userEvent.type(input, 'Cannot type this');
		await expect(input).toHaveValue('freundliche Katze Mika');
		await expect(input).toHaveAttribute('readonly');
	}
};
export const Saving: Story = { args: { disabled: true } };
