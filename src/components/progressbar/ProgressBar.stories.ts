import { Meta, StoryObj } from '@storybook/react';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
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
	},
	parameters: {
		// #1338: the percentage keeps its designed body colour over the bar
		// (#100001 on the red tenant's #a5000a, 2.54:1). Only it leaves the
		// colour-contrast audit.
		a11y: a11yExcept({ 'color-contrast': ['.progressbar__percent'] })
	}
};

export const Finished: Story = {
	args: {
		max: 100,
		current: 100,
		finish: true
	}
};
