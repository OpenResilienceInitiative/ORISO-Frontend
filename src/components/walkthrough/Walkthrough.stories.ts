import { Meta, StoryObj } from '@storybook/react';
import { Walkthrough } from './Walkthrough';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Organisms/Walkthrough',
	component: Walkthrough,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
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
