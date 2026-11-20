import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { RecommendFurtherCounsellingDialog } from './RecommendFurtherCounsellingDialog';

const topics = [
	{ id: 7, name: 'Schulden', slug: 'debt' },
	{ id: 9, name: 'Familie', slug: 'family' }
];

const meta = {
	title: 'Chat/System messages/Further counselling/Recommend modal',
	component: RecommendFurtherCounsellingDialog,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'FE#1876. The counsellor’s modal behind "Weitere Beratung empfehlen": every registration topic (current one included), an optional note of up to 1000 characters, and "Empfehlung senden". Only the topic list is served by a fixture here.'
			}
		}
	},
	args: { open: true, sessionId: 3363, onClose: fn(), onSent: fn() },
	beforeEach: () => {
		const originalFetch = globalThis.fetch;
		const fixture: typeof fetch = async (input, init) => {
			const url = new URL(new Request(input, init).url);
			if (url.pathname === '/service/topic/public') {
				return Response.json(topics);
			}
			return originalFetch(input, init);
		};
		globalThis.fetch = fixture;
		return () => {
			if (globalThis.fetch === fixture) globalThis.fetch = originalFetch;
		};
	},
	render: (args) => (
		<div style={{ minHeight: 640 }}>
			<RecommendFurtherCounsellingDialog {...args} />
		</div>
	)
} satisfies Meta<typeof RecommendFurtherCounsellingDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	play: async () => {
		const view = within(document.body);
		const dialog = await view.findByRole('dialog');
		await waitFor(() => expect(dialog).toBeVisible());
		await expect(
			view.getByRole('button', {
				name: /Empfehlung senden|Send recommendation/
			})
		).toBeDisabled();
	}
};

export const WithNote: Story = {
	play: async () => {
		const view = within(document.body);
		const note = await view.findByRole('textbox', {
			name: /Notiz|Note/
		});
		await userEvent.type(note, 'Bitte melden Sie sich dort direkt.');
		await waitFor(() => expect(view.getByText(/34 \/ 1000/)).toBeVisible());
	}
};
