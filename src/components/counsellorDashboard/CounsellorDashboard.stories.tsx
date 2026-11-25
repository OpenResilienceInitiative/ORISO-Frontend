import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { CounsellorDashboard } from './CounsellorDashboard';

/**
 * "Gespräche" with no conversation selected (#1795), calmed down after user
 * feedback that the screen was overloaded (Frank, 2026-11-25, variant C):
 * the turning cup and its line, with two small figures underneath. Direct
 * links are managed in "Meine Termine". Desktop and tablet only: on the
 * phone the list opens straight into the conversation, so this pane never
 * shows.
 */
const meta = {
	title: 'Components/Session/Counsellor overview',
	component: CounsellorDashboard,
	tags: ['autodocs'],
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<div
				style={{
					height: '100vh',
					minHeight: 560,
					display: 'flex',
					background: 'var(--m3-surface-container-high, #eae7e8)'
				}}
			>
				<Story />
			</div>
		)
	],
	args: {
		headline: 'Kurz durchatmen.\nAlles erledigt.',
		variant: 'conversation-nothing-to-do',
		stats: { assignedSessions: 11, activeSessions: 5 }
	}
} satisfies Meta<typeof CounsellorDashboard>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The cup, its line and two small figures. */
export const WithFigures: Story = {
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll('.counsellorDashboard__figure')
		).toHaveLength(2);
		// No tiles, links or switches on the overview.
		await expect(canvasElement.querySelector('button')).toBeNull();
		await expect(canvasElement.querySelector('[role="switch"]')).toBeNull();
	}
};

/** While loading, after a failure, or with statistics switched off. */
export const WithoutFigures: Story = {
	args: { stats: undefined },
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('.counsellorDashboard__figures')
		).toBeNull();
	}
};

/** Conversations exist but none is selected: the pane's own line stays. */
export const ConversationsWaiting: Story = {
	args: {
		headline: 'Bitte wählen Sie eine Nachricht aus',
		variant: 'conversation-history'
	}
};
