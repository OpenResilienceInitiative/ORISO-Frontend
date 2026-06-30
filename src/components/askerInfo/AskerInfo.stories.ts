import { Meta, StoryObj } from '@storybook/react';
import { AskerInfo } from './AskerInfo';

const meta = {
	title: 'Organisms/AskerInfo',
	component: AskerInfo,
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
					'Asker profile panel showing the active session user and their info content.'
			}
		}
	}
} satisfies Meta<typeof AskerInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
