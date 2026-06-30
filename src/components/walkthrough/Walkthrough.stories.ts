import { Meta, StoryObj } from '@storybook/react';
import { Walkthrough } from './Walkthrough';

const meta = {
	title: 'Organisms/Walkthrough',
	component: Walkthrough,
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
					'Guided intro.js walkthrough overlay for consultants; renders nothing unless the walkthrough is enabled in user data and app config.'
			}
		}
	}
} satisfies Meta<typeof Walkthrough>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
