import { Meta, StoryObj } from '@storybook/react';
import { WelcomeScreen } from './WelcomeScreen';

const meta = {
	title: 'REGISTRATION/WelcomeScreen',
	component: WelcomeScreen,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'WelcomeScreen component for the registration welcome page. Displays information about the registration process.'
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
