import { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingIndicator } from './LoadingIndicator';

const meta = {
	title: 'Atoms/LoadingIndicator',
	component: LoadingIndicator,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Compatibility entry point for the shared orbital Loading component.'
			}
		}
	}
} satisfies Meta<typeof LoadingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
