import { Meta, StoryObj } from '@storybook/react-vite';
import { WelcomeScreen } from './WelcomeScreen';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

const meta = {
	title: 'REGISTRATION/WelcomeScreen',
	component: WelcomeScreen,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'WelcomeScreen component for the registration welcome page. Displays information about the registration process.'
			}
		}
	}
} satisfies Meta<typeof WelcomeScreen>;

export default meta;
type Story = StoryObj<typeof WelcomeScreen>;

export const Default: Story = {
	args: {
		nextStepUrl: '/registration/next'
	}
};
