import { Meta, StoryObj } from '@storybook/react';
import { Tag } from './Tag';

const meta = {
	title: 'DISPLAY/Tag',
	component: Tag,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Tag component for displaying labels with color variants.'
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
	}
};

export const WithLink: Story = {
	args: {
		text: 'Clickable Tag',
		color: 'green',
		link: '/example'
	}
};
