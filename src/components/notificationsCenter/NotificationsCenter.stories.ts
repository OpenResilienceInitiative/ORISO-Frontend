import { Meta, StoryObj } from '@storybook/react';
import { NotificationsCenter } from './NotificationsCenter';

const meta = {
	title: 'Organisms/NotificationsCenter',
	component: NotificationsCenter,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		// TODO: paste this component's Figma node URL (right-click the frame in
		// Figma -> "Copy link to selection") to show it in the story's Design tab.
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/REPLACE_FILE_KEY/ORISO?node-id=0-1'
		},
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
