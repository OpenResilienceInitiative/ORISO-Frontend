import { Meta, StoryObj } from '@storybook/react-vite';
import { StepBar } from './StepBar';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

const meta = {
	title: 'REGISTRATION/StepBar',
	component: StepBar,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'StepBar component for displaying registration progress steps.'
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
