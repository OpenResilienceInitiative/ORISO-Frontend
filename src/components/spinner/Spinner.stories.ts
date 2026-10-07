import { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta = {
	title: 'FEEDBACK/Spinner',
	component: Spinner,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Compatibility entry point for shared orbital loading in the stage and theme loader.'
			}
		}
	}
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {}
};

export const Dark: Story = {
	args: {
		isDark: true
	}
};
