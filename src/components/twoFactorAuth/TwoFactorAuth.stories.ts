import { Meta, StoryObj } from '@storybook/react';
import { TwoFactorAuth } from './TwoFactorAuth';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Organisms/TwoFactorAuth',
	component: TwoFactorAuth,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
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
