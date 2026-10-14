import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	CaseHandoverReasonList,
	type CaseHandoverReasonListProps
} from './CaseHandoverReasonList';

const reasons = [
	{
		code: 'PLANNED_ABSENCE',
		label: 'Planned absence',
		clientConsentRequired: false
	},
	{
		code: 'UNPLANNED_ABSENCE',
		label: 'Unplanned absence',
		clientConsentRequired: false
	},
	{
		code: 'ASSIGNMENT_ENDED',
		label: 'Assignment ended',
		clientConsentRequired: false
	},
	{
		code: 'ADVICE_REQUESTED',
		label: 'Advice requested',
		clientConsentRequired: true
	}
];
function ReasonListPlayground(props: CaseHandoverReasonListProps) {
	const [reasonCode, setReasonCode] = useState(props.reasonCode);
	return (
		<CaseHandoverReasonList
			{...props}
			reasonCode={reasonCode}
			onReasonSelect={(code) => {
				setReasonCode(code);
				props.onReasonSelect(code);
			}}
		/>
	);
}
const meta = {
	title: 'Organisms/CaseHandover/ReasonList',
	component: CaseHandoverReasonList,
	tags: ['autodocs'],
	args: { reasons, reasonCode: '', interactive: true, onReasonSelect: fn() },
	render: ReasonListPlayground,
	parameters: {
		docs: {
			description: {
				component:
					'MUI RadioGroup, Radio, ListItemButton and ListItemText composed for the existing reason-selection contract. Selection and read-only description share the same reason labels, consent hints and keyboard number shortcuts.'
			}
		}
	}
} satisfies Meta<typeof CaseHandoverReasonList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectWithPointerAndKeyboard: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const advice = canvas.getByRole('radio', {
			name: /Rat erbeten|Advice requested|Conseil demandé/
		});
		await userEvent.click(advice);
		await expect(advice).toBeChecked();
		await expect(args.onReasonSelect).toHaveBeenCalledWith(
			'ADVICE_REQUESTED'
		);
		advice.focus();
		await userEvent.keyboard('1');
		await expect(
			canvas.getByRole('radio', {
				name: /Geplant abwesend|Planned absence|Absence planifiée/
			})
		).toBeChecked();
		await expect(args.onReasonSelect).toHaveBeenCalledWith(
			'PLANNED_ABSENCE'
		);
	}
};
export const ReadOnlyDescription: Story = {
	args: { interactive: false, reasonCode: 'ADVICE_REQUESTED' },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const advice = canvas.getByRole('radio', {
			name: /Rat erbeten|Advice requested|Conseil demandé/
		});
		await expect(advice).toBeChecked();
		for (const option of canvas.getAllByRole('radio'))
			await expect(option).toBeDisabled();
		await userEvent.click(
			canvas.getByText(/Rat erbeten|Advice requested|Conseil demandé/)
		);
		await expect(args.onReasonSelect).not.toHaveBeenCalled();
	}
};
