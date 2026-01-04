import { Meta, StoryObj } from '@storybook/react';
import { Headline } from './Headline';

const meta = {
	title: 'DISPLAY/Headline',
	component: Headline,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Headline component for displaying headings with semantic HTML levels.'
			}
		}
	}
} satisfies Meta<typeof Headline>;

export default meta;
type Story = StoryObj<typeof Headline>;

export const H1: Story = {
	args: {
		text: 'Heading Level 1',
		semanticLevel: '1'
	}
};

export const H2: Story = {
	args: {
		text: 'Heading Level 2',
		semanticLevel: '2'
	}
};

export const H3: Story = {
	args: {
		text: 'Heading Level 3',
		semanticLevel: '3'
	}
};

export const H4: Story = {
	args: {
		text: 'Heading Level 4',
		semanticLevel: '4'
	}
};

export const H5: Story = {
	args: {
		text: 'Heading Level 5',
		semanticLevel: '5'
	}
};
