import { Meta, StoryObj } from '@storybook/react';
import { TwoFactorAuth } from './TwoFactorAuth';

const meta = {
	title: 'Organisms/TwoFactorAuth',
	component: TwoFactorAuth,
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
					'Profile section that lets a user enable, edit or disable two-factor authentication; reads all state from UserData/AppConfig context.'
			}
		}
	}
} satisfies Meta<typeof TwoFactorAuth>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
