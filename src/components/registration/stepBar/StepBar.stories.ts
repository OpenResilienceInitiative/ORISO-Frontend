import { Meta, StoryObj } from '@storybook/react-vite';
import { StepBar } from './StepBar';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

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
