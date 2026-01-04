import { Meta, StoryObj } from '@storybook/react';
import { StepBar } from './StepBar';

const meta = {
	title: 'REGISTRATION/StepBar',
	component: StepBar,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'StepBar component for displaying registration progress steps.'
			}
		}
	}
} satisfies Meta<typeof StepBar>;

export default meta;
type Story = StoryObj<typeof StepBar>;

export const Default: Story = {
	args: {
		maxNumberOfSteps: 3,
		currentStep: 2
	}
};
