import { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';

const meta = {
	title: 'Organisms/Header',
	component: Header,
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
					'App header showing the localized title, UI version toggle, and either the agency logo or the tenant claim text.'
			}
		}
	}
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
