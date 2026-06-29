import { Meta, StoryObj } from '@storybook/react';
import { AskerInfo } from './AskerInfo';

const meta = {
	title: 'Organisms/AskerInfo',
	component: AskerInfo,
	tags: ['autodocs'],
	parameters: {
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
