import { Meta, StoryObj } from '@storybook/react-vite';
import { AccountData } from './AccountData';

const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const meta = {
	title: 'REGISTRATION/AccountData',
	component: AccountData,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: ORISO_M3_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'AccountData component for user registration account information input. Handles username, password, and data protection checkbox.'
			}
		}
	}
} satisfies Meta<typeof AccountData>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		onChange: () => {}
	}
};
