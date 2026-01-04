import { Meta, StoryObj } from '@storybook/react';
import { AgencySelection } from './AgencySelection';

const meta = {
	title: 'REGISTRATION/AgencySelection',
	component: AgencySelection,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'AgencySelection component for selecting an agency during registration based on topic and zipcode.'
			}
		}
	}
} satisfies Meta<typeof AgencySelection>;

export default meta;
type Story = StoryObj<typeof AgencySelection>;

export const Default: Story = {
	args: {
		onChange: () => {},
		nextStepUrl: '/registration/next',
		onNextClick: () => {}
	}
};
