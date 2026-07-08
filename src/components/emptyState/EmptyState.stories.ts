import { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';

const meta = {
	title: 'Molecules/EmptyState',
	component: EmptyState,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Empty-state placeholder showing a Lottie animation and a headline, varying by use case.'
			}
		}
	}
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoConversations: Story = {
	args: { headline: 'No conversations yet', variant: 'no-conversations' }
};

export const Inquiry: Story = {
	args: { headline: 'No open enquiries', variant: 'inquiry' }
};

export const Archive: Story = {
	args: { headline: 'Your archive is empty', variant: 'archive' }
};

export const ConversationNothingToDo: Story = {
	args: {
		headline: 'Nothing to do right now',
		variant: 'conversation-nothing-to-do'
	}
};
