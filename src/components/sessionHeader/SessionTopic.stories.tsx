import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SessionTopic } from './SessionTopic';

const meta = {
	title: 'Components/Session/SessionTopic',
	component: SessionTopic,
	tags: ['autodocs'],
	args: { name: 'Debt' },
	decorators: [
		(Story) => (
			<div className="sessionInfo__metaInfo">
				<Story />
			</div>
		)
	],
	parameters: {
		docs: {
			description: {
				component:
					'The actual chat header topic strip. This is informational text, with no click, link or button behavior. Both ordinary and protected cases reuse this display.'
			}
		}
	}
} satisfies Meta<typeof SessionTopic>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Debt')).toBeVisible();
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
	}
};
export const LongTopic: Story = {
	args: { name: 'Schwangerschaftsberatung und Unterstützung für Familien' }
};
