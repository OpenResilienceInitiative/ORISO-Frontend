import { Meta, StoryObj } from '@storybook/react';
import { Text } from './Text';

const meta = {
	title: 'DISPLAY/Text',
	component: Text,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component: 'Text component for displaying text content with various styling options.'
			}
		}
	}
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
	args: {
		type: 'standard',
		text: 'This is standard text content.'
	}
};

export const InfoLarge: Story = {
	args: {
		type: 'infoLargeStandard',
		text: 'This is large standard info text.'
	}
};

export const InfoMedium: Story = {
	args: {
		type: 'infoMedium',
		text: 'This is medium info text.'
	}
};

export const InfoSmall: Story = {
	args: {
		type: 'infoSmall',
		text: 'This is small info text.'
	}
};
