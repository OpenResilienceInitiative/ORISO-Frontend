import { Meta, StoryObj } from '@storybook/react-vite';
import { TopicSelection } from './TopicSelection';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

const meta = {
	title: 'REGISTRATION/TopicSelection',
	component: TopicSelection,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'TopicSelection component for selecting topics during registration.'
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
