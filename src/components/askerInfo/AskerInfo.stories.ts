import { Meta, StoryObj } from '@storybook/react';
import { AskerInfo } from './AskerInfo';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Organisms/AskerInfo',
	component: AskerInfo,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
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
