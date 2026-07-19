import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	CaseHandoverActionButton,
	CaseHandoverActionLabels,
	CaseHandoverActionState
} from './CaseHandoverActionButton';
import {
	CASE_HANDOVER_BULK_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './sessionsListItem.styles.scss';

const labels: CaseHandoverActionLabels = {
	requestAccess: 'Request access',
	awaitingApproval: 'Awaiting approval',
	accessGranted: 'Access granted',
	accessDenied: 'Access denied',
	selectCase: 'Select case',
	menuLabel: 'Case handover options',
	selectMultipleTitle: 'Select multiple conversations',
	selectMultipleDescription:
		'You can instantly select several cases from the chat history and apply a case handover at once.',
	confirmSelectionTitle: 'Confirm selection',
	confirmSelectionDescription:
		'Proceed with your currently selected items to request a case handover.',
	deselectTitle: 'Deselect and close',
	deselectDescription: 'Deselects everything and closes the batch mode.'
};

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: '24px 24px 140px',
	maxWidth: 420,
	margin: '0 auto',
	display: 'flex',
	justifyContent: 'flex-end',
	// The `.sessionsListItem` card class carries an entrance animation that
	// starts at opacity:0; in this static button story it only makes the
	// interaction play-test flaky (jest-dom toBeVisible reads opacity:0
	// mid-animation). Neutralise it here — it is irrelevant to this story.
	opacity: 1,
	animation: 'none'
};

const Frame = ({ children }: { children: React.ReactNode }) => (
	<div style={shell} className="sessionsListItem">
		{children}
	</div>
);

const meta: Meta = {
	title: 'Organisms/CaseHandover/CaseHandoverActionButton',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'CARX Case Handover — Section 05 states board',
				url: CASE_HANDOVER_BULK_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Split button on a session card driving the case-handover flow (Figma Section 05 states board). Default mode: primary segment requests access (or shows the read-only status pill), the chevron opens a menu with **Select multiple conversations**. Batch mode: primary segment is a **Select case** checkbox, the menu offers **Confirm selection** / **Deselect and close**.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

const staticStory = (
	state: CaseHandoverActionState,
	extra: Partial<React.ComponentProps<typeof CaseHandoverActionButton>> = {}
): Story => ({
	render: () => (
		<Frame>
			<CaseHandoverActionButton
				labels={labels}
				state={state}
				{...extra}
			/>
		</Frame>
	)
});

export const RequestAccess: Story = staticStory('requestAccess');
export const RequestAccessActiveCard: Story = staticStory('requestAccess', {
	active: true
});
export const AwaitingApproval: Story = staticStory('awaitingApproval');
export const AccessGranted: Story = staticStory('accessGranted');
export const AccessDenied: Story = staticStory('accessDenied');

export const BatchSelectUnchecked: Story = staticStory('requestAccess', {
	batchMode: true
});
export const BatchSelectChecked: Story = staticStory('requestAccess', {
	batchMode: true,
	selected: true
});
export const BatchDisabled: Story = staticStory('requestAccess', {
	batchMode: true,
	disabled: true
});

export const MenuOpenDefault: Story = {
	render: () => (
		<Frame>
			<CaseHandoverActionButton
				labels={labels}
				state="requestAccess"
				onSelectMultiple={() => {}}
			/>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: labels.menuLabel })
		);
		await expect(
			await canvas.findByRole('menuitem', {
				name: new RegExp(labels.selectMultipleTitle)
			})
		).toBeVisible();
	}
};

export const MenuOpenBatch: Story = {
	render: () => (
		<Frame>
			<CaseHandoverActionButton
				labels={labels}
				state="requestAccess"
				batchMode
				selected
				onConfirmSelection={() => {}}
				onDeselectAndClose={() => {}}
			/>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: labels.menuLabel })
		);
		await expect(
			await canvas.findByRole('menuitem', {
				name: new RegExp(labels.confirmSelectionTitle)
			})
		).toBeVisible();
		await expect(
			canvas.getByRole('menuitem', {
				name: new RegExp(labels.deselectTitle)
			})
		).toBeVisible();
	}
};

function BatchTogglePlayground() {
	const [selected, setSelected] = useState(false);
	return (
		<Frame>
			<CaseHandoverActionButton
				labels={labels}
				state="requestAccess"
				batchMode
				selected={selected}
				onToggleSelect={() => setSelected((prev) => !prev)}
			/>
		</Frame>
	);
}

/** Checkbox toggling drives aria-checked (batch selection). */
export const BatchToggleInteraction: Story = {
	render: () => <BatchTogglePlayground />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox', {
			name: new RegExp(labels.selectCase)
		});
		await expect(checkbox).toHaveAttribute('aria-checked', 'false');
		await userEvent.click(checkbox);
		await expect(checkbox).toHaveAttribute('aria-checked', 'true');
	}
};
