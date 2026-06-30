import { Meta, StoryObj } from '@storybook/react-vite';
import { ZipcodeInput } from './ZipcodeInput';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

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
