import { Meta, StoryObj } from '@storybook/react';
import { TopicSelection } from './TopicSelection';

const meta = {
	title: 'REGISTRATION/TopicSelection',
	component: TopicSelection,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'TopicSelection component for selecting topics during registration.'
			}
		}
	}
} satisfies Meta<typeof TopicSelection>;

export default meta;
type Story = StoryObj<typeof TopicSelection>;

export const Default: Story = {
	args: {
		onChange: () => {},
		nextStepUrl: '/registration/next',
		onNextClick: () => {}
	}
};
