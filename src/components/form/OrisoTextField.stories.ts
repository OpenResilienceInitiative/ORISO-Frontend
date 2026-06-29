import { Meta, StoryObj } from '@storybook/react';
import { OrisoTextField } from './OrisoTextField';

const meta = {
	title: 'Atoms/OrisoTextField',
	component: OrisoTextField,
	tags: ['autodocs'],
	parameters: { docs: { description: { component: 'ORISO-styled MUI TextField wrapper that merges the ORISO input design tokens into the sx prop.' } } }
} satisfies Meta<typeof OrisoTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: 'Name', placeholder: 'Enter your name' } };
export const Filled: Story = { args: { label: 'Email', defaultValue: 'user@example.com' } };
export const Error: Story = { args: { label: 'Password', error: true, helperText: 'Password is required' } };
export const Disabled: Story = { args: { label: 'Read only', defaultValue: 'Cannot edit', disabled: true } };
