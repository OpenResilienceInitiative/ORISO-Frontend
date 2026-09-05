/**
 * WP-B2 — the side-room composer. Transport is a prop (`onSend`), so the
 * stories check the interaction contract: Enter sends, Shift+Enter breaks
 * the line, a rejected send keeps the text and shows the error line.
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { SupervisionComposer } from './SupervisionComposer';
import { SUPERVISOR_NAME } from './supervisionPanel.fixtures';
import './supervisionPanel.styles.scss';

const meta = {
	title: 'Components/Session/SupervisionComposer',
	component: SupervisionComposer,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Plain-text composer for the supervision side room. Enter sends, Shift+Enter inserts a line break; the owner supplies `onSend` (SessionItemComponent routes it through chatTransportService).'
			}
		}
	},
	args: {
		counterpartName: SUPERVISOR_NAME,
		onSend: fn()
	},
	decorators: [
		(Story) => (
			<div style={{ width: 420 }}>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof SupervisionComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

const byCy = (root: HTMLElement, cy: string) =>
	root.querySelector(`[data-cy="${cy}"]`) as HTMLElement;
const waitFor = async (probe: () => HTMLElement | null, tries = 20) => {
	for (let i = 0; i < tries; i += 1) {
		const node = probe();
		if (node) {
			return node;
		}
		await new Promise<void>((resolve) => setTimeout(resolve, 25));
	}
	return probe();
};

export const Default: Story = {};

export const EnterSends: Story = {
	play: async ({ canvasElement, args }) => {
		const input = byCy(canvasElement, 'supervision-composer-input');
		await userEvent.type(input, 'Kurze Rückfrage{enter}');
		await expect(args.onSend).toHaveBeenCalledWith('Kurze Rückfrage');
		await expect(input).toHaveValue('');
	}
};

export const ShiftEnterBreaksLine: Story = {
	play: async ({ canvasElement, args }) => {
		const input = byCy(canvasElement, 'supervision-composer-input');
		await userEvent.type(input, 'erste{shift>}{enter}{/shift}zweite');
		await expect(args.onSend).not.toHaveBeenCalled();
		await expect(input).toHaveValue('erste\nzweite');
	}
};

export const EmptyNeverSends: Story = {
	play: async ({ canvasElement, args }) => {
		const send = byCy(canvasElement, 'supervision-composer-send');
		await expect(send).toBeDisabled();
		await userEvent.type(
			byCy(canvasElement, 'supervision-composer-input'),
			'   {enter}'
		);
		await expect(args.onSend).not.toHaveBeenCalled();
	}
};

const Failing = () => {
	const [attempts, setAttempts] = useState(0);
	return (
		<SupervisionComposer
			counterpartName={SUPERVISOR_NAME}
			onSend={async () => {
				setAttempts((n) => n + 1);
				throw new Error('transport down');
			}}
			data-cy={`supervision-composer-${attempts}`}
		/>
	);
};

export const SendFailureKeepsText: Story = {
	render: () => <Failing />,
	play: async ({ canvasElement }) => {
		const input = byCy(canvasElement, 'supervision-composer-input');
		await userEvent.type(input, 'bleibt stehen{enter}');
		const error = await waitFor(() =>
			byCy(canvasElement, 'supervision-composer-error')
		);
		await expect(error).toBeVisible();
		await expect(input).toHaveValue('bleibt stehen');
		await expect(input).toHaveAttribute('aria-invalid', 'true');
	}
};

export const Disabled: Story = {
	args: { disabled: true },
	play: async ({ canvasElement }) => {
		await expect(
			byCy(canvasElement, 'supervision-composer-input')
		).toBeDisabled();
		await expect(
			byCy(canvasElement, 'supervision-composer-send')
		).toBeDisabled();
	}
};
