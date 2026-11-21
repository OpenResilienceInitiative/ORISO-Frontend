import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EnquiryTeamAction } from './EnquiryTeamAction';
import './session.styles.scss';

const meta = {
	title: 'Organisms/Session/EnquiryTeamAction',
	component: EnquiryTeamAction,
	args: { onOpen: fn() }
} satisfies Meta<typeof EnquiryTeamAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithUnreadMessages: Story = {
	args: { unreadCount: 2 },
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole('button');
		await expect(button).toHaveAccessibleName(/2/);
		await userEvent.click(button);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
	}
};
