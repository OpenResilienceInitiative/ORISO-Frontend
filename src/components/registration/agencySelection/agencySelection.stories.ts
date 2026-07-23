import { Meta, StoryObj } from '@storybook/react-vite';
import { AgencySelection } from './AgencySelection';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

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
