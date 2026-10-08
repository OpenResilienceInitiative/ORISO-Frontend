import * as React from 'react';
import { expect, within } from 'storybook/test';
import { LiveChatChecking } from '../anonymousChat/entryRoom/LiveChatChecking';
import { Loading } from '../app/Loading';
import { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta = {
	title: 'FEEDBACK/Spinner',
	component: Spinner,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Shared large loader: the existing single live-chat orbital visual. Inline LoadingIndicator and LoadingSpinner stay compact.'
			}
		}
	}
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {}
};

export const Dark: Story = {
	globals: { scheme: 'dark' },
	args: {
		isDark: true
	}
};

export const LiveChatReferenceAndPage: Story = {
	render: () => (
		<div data-testid="loader-host" style={{ width: '100%', minWidth: 0 }}>
			<Spinner />
			<LiveChatChecking text="Live-chat reference" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector<HTMLElement>(
			'[data-testid="loader-host"]'
		)!;
		for (const width of [320, 390, 412, 820, 1440]) {
			host.style.width = `${Math.min(width, window.innerWidth - 32)}px`;
			await new Promise((resolve) => requestAnimationFrame(resolve));
			const canvases = Array.from(host.querySelectorAll('canvas'));
			expect(canvases).toHaveLength(2);
			const bounds = canvases.map((canvas) =>
				canvas.getBoundingClientRect()
			);
			expect(Math.abs(bounds[0].width - bounds[1].width)).toBeLessThan(1);
			const hostRect = host.getBoundingClientRect();
			for (const rect of bounds) {
				expect(
					Math.abs(
						(rect.left + rect.right) / 2 -
							(hostRect.left + hostRect.right) / 2
					)
				).toBeLessThan(1);
				expect(rect.width).toBeGreaterThanOrEqual(208);
				expect(rect.width).toBeLessThanOrEqual(260);
				expect(rect.left).toBeGreaterThanOrEqual(hostRect.left);
				expect(rect.right).toBeLessThanOrEqual(hostRect.right);
			}
		}
		host.style.width = '100%';
	}
};
export const SessionLoading: Story = {
	render: () => <Loading />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByRole('status');
		expect(canvasElement.querySelector('canvas')).not.toBeNull();
	}
};
