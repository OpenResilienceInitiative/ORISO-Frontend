import { Meta, StoryObj } from '@storybook/react';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
import { Tag } from './Tag';

const meta = {
	title: 'Atoms/Tag',
	component: Tag,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Tag component for displaying labels with color variants.'
			}
		}
	}
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Green: Story = {
	args: {
		text: 'Success',
		color: 'green'
	}
};

export const Yellow: Story = {
	args: {
		text: 'Warning',
		color: 'yellow'
	}
};

export const Red: Story = {
	args: {
		text: 'Error',
		color: 'red'
	},
	parameters: {
		// #1338: the red tag keeps its designed colours (white on #ff0000,
		// 3.99:1). Only it leaves the colour-contrast audit.
		a11y: a11yExcept({ 'color-contrast': ['.tag--red'] })
	}
};

export const WithLink: Story = {
	args: {
		text: 'Clickable Tag',
		color: 'green',
		link: '/example'
	}
};
