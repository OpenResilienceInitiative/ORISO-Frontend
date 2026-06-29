import { Meta, StoryObj } from '@storybook/react';
import { Walkthrough } from './Walkthrough';

const meta = {
	title: 'Organisms/Walkthrough',
	component: Walkthrough,
	tags: ['autodocs'],
	parameters: {
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
