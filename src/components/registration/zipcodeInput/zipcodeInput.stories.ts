import { Meta, StoryObj } from '@storybook/react-vite';
import { ZipcodeInput } from './ZipcodeInput';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

const meta = {
	title: 'REGISTRATION/ZipcodeInput',
	component: ZipcodeInput,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'ZipcodeInput component for entering postal code during registration. Validates and updates registration data.'
			}
		}
	}
} satisfies Meta<typeof ZipcodeInput>;

export default meta;
type Story = StoryObj<typeof ZipcodeInput>;

export const Default: Story = {
	args: {
		onChange: () => {}
	}
};
