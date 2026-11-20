import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CaseHandoverBulkBar } from './CaseHandoverBulkBar';
import { CASE_HANDOVER_BULK_FIGMA_URL } from '../storybookDesignLinks';

const labelsFor = (count: number) => ({
	region: 'Case selection',
	selected: `${count} selected`,
	continueLabel: 'Continue',
	cancel: 'Cancel',
	emptyHint: 'Select at least one case.'
});

const meta: Meta = {
	title: 'Organisms/CaseHandover/CaseHandoverBulkBar',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: {
			type: 'figma',
			name: 'CARX Case Handover — Section 05 states board',
			url: CASE_HANDOVER_BULK_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Sticky bar under the case list while batch mode is on (FE#1725 US23/24): "N selected", **Cancel** and **Continue**. Continue opens the request wizard for every selected case; with nothing selected it is disabled and the bar says why. Buttons are the shared `ButtonGroup` (outline Cancel, primary Continue). The phone layouts with cards live in `CaseHandoverActionButton` → Phone 320/390.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Bulk bar callbacks fire; an empty selection cannot continue. */
export const BulkBarActions: Story = {
	name: 'Bulk bar — Continue and Cancel',
	args: { onContinue: fn(), onCancel: fn() },
	render: (args) => (
		<div style={{ width: 390, paddingTop: 40, background: '#eae7e8' }}>
			<CaseHandoverBulkBar
				count={3}
				labels={labelsFor(3)}
				onContinue={args.onContinue as () => void}
				onCancel={args.onCancel as () => void}
			/>
		</div>
	),
	play: async ({ args, canvasElement }) => {
		const bar = within(canvasElement).getByRole('region', {
			name: 'Case selection'
		});
		await expect(within(bar).getByRole('status')).toHaveTextContent(
			'3 selected'
		);
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Continue' })
		);
		await expect(args.onContinue).toHaveBeenCalledTimes(1);
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Cancel' })
		);
		await expect(args.onCancel).toHaveBeenCalledTimes(1);
	}
};

export const BulkBarEmpty: Story = {
	name: 'Bulk bar — nothing selected yet',
	args: { onContinue: fn(), onCancel: fn() },
	render: (args) => (
		<div style={{ width: 320, paddingTop: 40, background: '#eae7e8' }}>
			<CaseHandoverBulkBar
				count={0}
				labels={labelsFor(0)}
				onContinue={args.onContinue as () => void}
				onCancel={args.onCancel as () => void}
			/>
		</div>
	),
	play: async ({ args, canvasElement }) => {
		const bar = within(canvasElement).getByRole('region', {
			name: 'Case selection'
		});
		const next = within(bar).getByRole('button', { name: 'Continue' });
		await expect(next).toBeDisabled();
		await expect(bar).toHaveTextContent('Select at least one case.');
		await userEvent.click(next, { pointerEventsCheck: 0 });
		await expect(args.onContinue).not.toHaveBeenCalled();
	}
};
