import { createElement } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { TwoFactorAuth } from './TwoFactorAuth';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Organisms/TwoFactorAuth',
	component: TwoFactorAuth,
	tags: ['autodocs'],
	// The setup dialog it holds registers with the modal stack, as in the app (#1338).
	decorators: [
		(Story) => createElement(ModalProvider, null, createElement(Story))
	],
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
