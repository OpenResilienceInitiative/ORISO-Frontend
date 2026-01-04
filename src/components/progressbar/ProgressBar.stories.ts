import { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta = {
	title: 'UI/ProgressBar',
	component: ProgressBar,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'ProgressBar component for displaying progress.'
			}
		}
	}
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
	args: {
		max: 100,
		current: 50
	}
};

export const HalfComplete: Story = {
	args: {
		max: 100,
		current: 50
	}
};

export const AlmostComplete: Story = {
	args: {
		max: 100,
		current: 90
	}
};

export const WithPercent: Story = {
	args: {
		max: 100,
		current: 75,
		showPercent: true
	}
};

export const Finished: Story = {
	args: {
		max: 100,
		current: 100,
		finish: true
	}
};
