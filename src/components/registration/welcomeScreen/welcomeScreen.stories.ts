import { Meta, StoryObj } from '@storybook/react-vite';
import { WelcomeScreen } from './WelcomeScreen';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

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
