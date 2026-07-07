import { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner } from './LoadingSpinner';

const meta = {
	title: 'Atoms/LoadingSpinner',
	component: LoadingSpinner,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'LoadingSpinner component for displaying loading states.'
			}
		}
	}
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {
	args: {}
};
