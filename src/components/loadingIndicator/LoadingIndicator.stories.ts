import { Meta, StoryObj } from '@storybook/react';
import { LoadingIndicator } from './LoadingIndicator';

const meta = {
	title: 'Atoms/LoadingIndicator',
	component: LoadingIndicator,
	tags: ['autodocs'],
	parameters: { docs: { description: { component: 'Animated bouncing loading spinner indicator.' } } }
} satisfies Meta<typeof LoadingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
