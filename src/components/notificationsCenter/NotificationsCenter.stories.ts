import { Meta, StoryObj } from '@storybook/react';
import { NotificationsCenter } from './NotificationsCenter';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Organisms/NotificationsCenter',
	component: NotificationsCenter,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Activity Timeline center: a master-detail list of activity events with family-filter chips, search, and an embedded chat preview. Reads its feed from the app activity context.'
			}
		}
	}
} satisfies Meta<typeof NotificationsCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
