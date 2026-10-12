/**
 * The "Jetzt · Zukünftige Termine anzeigen" strip above the session list.
 *
 * T41b (Frank, 15.09.2026): in the 80 px rail the label had nowhere to go
 * and the browser set it one letter per line. In the rail the strip is the
 * arrow alone — a placeholder until the rail gets its own design — with the
 * full sentence as its accessible name.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { FutureTimelinePanel } from './FutureTimelinePanel';
import { SessionListRailProvider } from './SessionListRailContext';
import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import './futureTimelinePanel.styles';

const Column = ({ width, rail }: { width: number; rail: boolean }) => (
	<div
		style={{
			width,
			background: 'var(--m3-surface-container-low, #f6f3f3)',
			padding: '8px 0'
		}}
		data-cy="future-timeline-column"
	>
		<SessionListRailProvider rail={rail}>
			<FutureTimelinePanel series={[]} includeAppointments={false} />
		</SessionListRailProvider>
	</div>
);

const meta: Meta<typeof FutureTimelinePanel> = {
	title: 'Components/Session/List/Future timeline strip',
	component: FutureTimelinePanel
};
export default meta;
type Story = StoryObj<typeof FutureTimelinePanel>;

export const ExpandedColumn: Story = {
	name: 'Expanded column — "Jetzt" and the full label',
	render: () => <Column width={420} rail={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Jetzt')).toBeVisible();
		const toggle = canvas.getByRole('button');
		await expect(toggle.textContent).toContain('Zukünftige Termine');
	}
};

export const InTheRail: Story = {
	name: 'In the 80 px rail — the arrow alone (T41b)',
	render: () => <Column width={STAGE_LAYOUT.RAIL_WIDTH} rail />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button');
		// No text to squeeze: the glyph carries it, the sentence names it.
		await expect(toggle.textContent?.trim()).toBe('');
		await expect(toggle.getAttribute('aria-label')).toContain(
			'Zukünftige Termine'
		);
		await expect(toggle.querySelector('svg')).not.toBeNull();
		// The strip fits the rail instead of overflowing it.
		const column = canvasElement.querySelector<HTMLElement>(
			'[data-cy="future-timeline-column"]'
		)!;
		await expect(
			Math.round(toggle.getBoundingClientRect().width)
		).toBeLessThanOrEqual(Math.round(column.getBoundingClientRect().width));
		// One line, not one letter per line.
		await expect(
			Math.round(toggle.getBoundingClientRect().height)
		).toBeLessThan(48);
	}
};
