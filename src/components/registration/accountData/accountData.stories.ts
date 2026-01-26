import { Meta, StoryObj } from '@storybook/react';
import { AccountData } from './AccountData';

const meta = {
	title: 'REGISTRATION/AccountData',
	component: AccountData,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'AccountData component for user registration account information input. Handles username, password, and data protection checkbox.'
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
