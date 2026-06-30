import { Meta, StoryObj } from '@storybook/react';
import { BanUser } from './BanUser';

const meta = {
	title: 'Organisms/BanUser',
	component: BanUser,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Trigger button that bans a user from a chat via the ban API.'
			}
		}
	}
} satisfies Meta<typeof BanUser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		rcUserId: 'rc-user-123',
		userName: 'Anonymous-User',
		chatId: 1,
		handleUserBan: () => {}
	}
};
