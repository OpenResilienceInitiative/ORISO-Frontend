import { Meta, StoryObj } from '@storybook/react-vite';
import { AccountData } from './AccountData';
import { ORISO_M3_FIGMA_URL } from '../../storybookDesignLinks';

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
