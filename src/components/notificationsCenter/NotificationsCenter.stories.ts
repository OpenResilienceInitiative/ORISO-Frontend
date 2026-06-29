import { Meta, StoryObj } from '@storybook/react';
import { NotificationsCenter } from './NotificationsCenter';

const meta = {
	title: 'Organisms/NotificationsCenter',
	component: NotificationsCenter,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Activity timeline center: a master-detail list of notifications with family-filter chips, search, and an embedded chat preview. Reads its feed from NotificationsContext.'
			}
		}
	}
} satisfies Meta<typeof NotificationsCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
