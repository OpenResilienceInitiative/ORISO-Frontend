import * as React from 'react';
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
		// #1158: menu is portalled to document.body so card overflow cannot
		// clip it — query the body, not the story canvas.
		const body = within(document.body);
		await userEvent.click(
			canvas.getByRole('button', { name: labels.menuLabel })
		);
		const menuItem = await body.findByRole('menuitem', {
			name: new RegExp(labels.selectMultipleTitle)
		});
		// The shared menu reveal fades in from opacity 0 (160 ms).
		await waitFor(() => expect(menuItem).toBeVisible());
		await expect(menuItem.closest('[role="menu"]')?.parentElement).toBe(
			document.body
		);
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
		// #1158: menu is portalled to document.body so card overflow cannot
		// clip it — query the body, not the story canvas.
		const body = within(document.body);
		await userEvent.click(
			canvas.getByRole('button', { name: labels.menuLabel })
		);
		const confirmItem = await body.findByRole('menuitem', {
			name: new RegExp(labels.confirmSelectionTitle)
		});
		// The shared menu reveal fades in from opacity 0 (160 ms).
		await waitFor(() => expect(confirmItem).toBeVisible());
		await expect(
			body.getByRole('menuitem', {
				name: new RegExp(labels.deselectTitle)
			})
		).toBeVisible();
	}
};

/**
 * The menu opens BESIDE the card it sits in, not on top of it — the same
 * rule as the chat-room menu of the session card (Frank, 15.09.2026: "Es
 * soll kein Overlap da sein, sondern ein Nebeneinander."). The card is
 * passed as `surfaceRef`; without it the menu only avoids the chevron and
 * still covers the conversation text underneath.
 */
function MenuBesideCardDemo() {
	const cardRef = useRef<HTMLDivElement>(null);
	return (
		<div
			style={{ ...shell, display: 'block' }}
			className="sessionsListItem"
		>
			<div
				ref={cardRef}
				data-testid="case-handover-card-surface"
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
					minHeight: 128,
					padding: 16,
					borderRadius: 24,
					background: '#ffffff'
				}}
			>
				<strong>Beratungsfall 4711</strong>
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<CaseHandoverActionButton
						labels={labels}
						state="requestAccess"
						surfaceRef={cardRef}
						onSelectMultiple={() => {}}
					/>
				</div>
				<p style={{ margin: 0 }}>
					Letzte Nachricht: Danke für das Gespräch gestern.
				</p>
			</div>
		</div>
	);
}

export const MenuBesideTheCard: Story = {
	name: 'Menü — neben der Karte statt darüber',
	render: () => <MenuBesideCardDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: labels.menuLabel })
		);
		const menu = await within(document.body).findByRole('menu', {
			name: labels.menuLabel
		});
		await waitFor(() => expect(menu).toBeVisible());
		const surface = canvas.getByTestId('case-handover-card-surface');

		// DOMRect fields live on the prototype, so read them one by one.
		const m = menu.getBoundingClientRect();
		const c = surface.getBoundingClientRect();
		const menuBox = {
			left: m.left,
			right: m.right,
			top: m.top,
			bottom: m.bottom
		};
		const cardBox = {
			left: c.left,
			right: c.right,
			top: c.top,
			bottom: c.bottom
		};

		// 1. Beside the card, with a visible gap — there is room on the right.
		await expect(menuBox.left).toBeGreaterThanOrEqual(cardBox.right + 4);
		// 2. No overlap at all, whatever the side.
		const apart =
			menuBox.right <= cardBox.left + 0.5 ||
			menuBox.left >= cardBox.right - 0.5 ||
			menuBox.bottom <= cardBox.top + 0.5 ||
			menuBox.top >= cardBox.bottom - 0.5;
		await expect(apart).toBe(true);
		// 3. The placement is exposed for styling, like the chat-room menu.
		await expect(menu.dataset.placement).toBe('right');
		// 4. The menu stays above its own backdrop (999998 vs. 999999).
		const backdrop =
			document.querySelector<HTMLElement>('.orisoMenuBackdrop');
		if (backdrop) {
			await expect(Number(getComputedStyle(menu).zIndex)).toBeGreaterThan(
				Number(getComputedStyle(backdrop).zIndex)
			);
		}
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
