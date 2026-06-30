import { Meta, StoryObj } from '@storybook/react-vite';
import { TopicSelection } from './TopicSelection';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

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
