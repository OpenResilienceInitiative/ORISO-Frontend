import { Meta, StoryObj } from '@storybook/react-vite';
import { AgencySelection } from './AgencySelection';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const meta = {
	title: 'REGISTRATION/AgencySelection',
	component: AgencySelection,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'AgencySelection component for selecting an agency during registration based on topic and zipcode.'
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
