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
import { CaseHandoverBulkBar } from '../sessionsList/CaseHandoverBulkBar';
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
					'Split button on a session card driving the case-handover flow (Figma Section 05 states board), built on the `SplitButton` atom at 40px. Default mode: outlined **Request access** (or the read-only status pill); the chevron opens **Select multiple conversations**. Batch mode (FE#1725): the main segment is the shared M3 checkbox **Select case** — outlined while unselected, filled primary once selected; granted or pending cases keep their status pill and cannot be selected. The open case is marked by the card, never by the button colour.'
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

const PRIMARY_RGB = 'rgb(165, 0, 10)';

/** Main segment of the split button (checkbox host or action button). */
const mainSegment = (root: HTMLElement) =>
	root.querySelector<HTMLElement>(
		'[data-cy="case-handover-action"] .splitButton__main'
	)!;

const isTransparent = (color: string) =>
	color === 'transparent' || color === 'rgba(0, 0, 0, 0)';

export const RequestAccess: Story = {
	...staticStory('requestAccess'),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const main = canvas.getByRole('button', { name: labels.requestAccess });
		// Outlined: nothing looks "on" before anything was chosen.
		await expect(
			isTransparent(getComputedStyle(main).backgroundColor)
		).toBe(true);
		await expect(main.getBoundingClientRect().height).toBe(40);
	}
};
export const AwaitingApproval: Story = staticStory('awaitingApproval');
export const AccessGranted: Story = staticStory('accessGranted');
export const AccessDenied: Story = staticStory('accessDenied');

/** Unselected: outlined segment with an empty shared M3 checkbox. */
export const BatchSelectUnchecked: Story = {
	...staticStory('requestAccess', { batchMode: true }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox', {
			name: labels.selectCase
		});
		await expect(checkbox).not.toBeChecked();
		const segment = mainSegment(canvasElement);
		await expect(
			isTransparent(getComputedStyle(segment).backgroundColor)
		).toBe(true);
		await expect(getComputedStyle(segment).borderTopWidth).toBe('1px');
		await expect(segment.getBoundingClientRect().height).toBe(40);
	}
};

/** Selected: filled primary segment with a ticked checkbox. */
export const BatchSelectChecked: Story = {
	...staticStory('requestAccess', { batchMode: true, selected: true }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('checkbox', { name: labels.selectCase })
		).toBeChecked();
		await expect(
			getComputedStyle(mainSegment(canvasElement)).backgroundColor
		).toBe(PRIMARY_RGB);
	}
};

/** Granted or pending: status pill, nothing to select. */
export const BatchAlreadyGranted: Story = {
	...staticStory('accessGranted', { batchMode: true }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole('checkbox')).toBeNull();
		await expect(
			canvas.getByRole('button', { name: labels.accessGranted })
		).toBeDisabled();
	}
};
export const BatchAwaitingApproval: Story = {
	...staticStory('awaitingApproval', { batchMode: true }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole('checkbox')).toBeNull();
		await expect(
			canvas.getByRole('button', { name: labels.awaitingApproval })
		).toBeDisabled();
	}
};
export const BatchDisabled: Story = staticStory('requestAccess', {
	batchMode: true,
	disabled: true
});

const cardStyle: React.CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	gap: 4,
	padding: '12px 0 0 16px',
	opacity: 1,
	animation: 'none'
};

/** A card frame with the real card classes, so active styling applies. */
const DemoCard = ({
	title,
	active = false,
	children
}: {
	title: string;
	active?: boolean;
	children: React.ReactNode;
}) => (
	<div
		className={`sessionsListItem${active ? ' sessionsListItem--active' : ''}`}
		style={{ opacity: 1, animation: 'none' }}
		data-testid={`card-${title}`}
	>
		<div className="sessionsListItem__content" style={cardStyle}>
			<strong>{title}</strong>
			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				{children}
			</div>
		</div>
	</div>
);

/**
 * Open case vs. selected case: the open card is marked by its own outline
 * and tint, the button stays outlined (US20).
 */
export const ActiveCardIsNotSelected: Story = {
	name: 'Open card ≠ selected case',
	render: () => (
		<div style={{ ...shell, display: 'grid', gap: 12 }}>
			<DemoCard title="Open case" active>
				<CaseHandoverActionButton
					labels={labels}
					state="requestAccess"
					batchMode
				/>
			</DemoCard>
			<DemoCard title="Selected case">
				<CaseHandoverActionButton
					labels={labels}
					state="requestAccess"
					batchMode
					selected
				/>
			</DemoCard>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const openCard = canvas.getByTestId('card-Open case');
		const selectedCard = canvas.getByTestId('card-Selected case');
		const openContent = openCard.firstElementChild as HTMLElement;
		// The open card carries the 2px primary outline.
		await expect(getComputedStyle(openContent).borderTopWidth).toBe('2px');
		await expect(getComputedStyle(openContent).borderTopColor).toBe(
			PRIMARY_RGB
		);
		// Its button stays outlined; only the selected case is filled.
		await expect(
			isTransparent(
				getComputedStyle(mainSegment(openCard)).backgroundColor
			)
		).toBe(true);
		await expect(
			getComputedStyle(mainSegment(selectedCard)).backgroundColor
		).toBe(PRIMARY_RGB);
	}
};

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

/** Proves the menu opens beside the card passed as `surfaceRef`, never on top of it. */
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
		const backdrop = await waitFor(() => {
			const element =
				document.querySelector<HTMLElement>('.orisoMenuBackdrop');
			expect(element).toBeTruthy();
			return element!;
		});
		await expect(Number(getComputedStyle(menu).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(backdrop).zIndex)
		);
		// 5. The veil leaves the card uncovered, the page around it not.
		await waitFor(() =>
			expect(
				surface.contains(
					document.elementFromPoint(
						cardBox.left + 12,
						cardBox.top + 12
					)
				)
			).toBe(true)
		);
		await expect(
			document.elementFromPoint(cardBox.left - 12, cardBox.top + 12)
		).toBe(backdrop);
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

/** Click and keyboard (Space) toggle the shared checkbox. */
export const BatchToggleInteraction: Story = {
	render: () => <BatchTogglePlayground />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const checkbox = canvas.getByRole('checkbox', {
			name: labels.selectCase
		});
		await expect(checkbox).not.toBeChecked();
		await userEvent.click(checkbox);
		await expect(checkbox).toBeChecked();
		// The segment colour animates (150 ms); wait for the filled state.
		await waitFor(() =>
			expect(
				getComputedStyle(mainSegment(canvasElement)).backgroundColor
			).toBe(PRIMARY_RGB)
		);
		// Clicking the visible label toggles too (whole segment is the target).
		await userEvent.click(canvas.getByText(labels.selectCase));
		await expect(checkbox).not.toBeChecked();
		// Keyboard: Tab reaches the checkbox first, then the menu chevron.
		checkbox.blur();
		await userEvent.tab();
		await expect(checkbox).toHaveFocus();
		await userEvent.keyboard(' ');
		await expect(checkbox).toBeChecked();
		await userEvent.tab();
		await expect(
			canvas.getByRole('button', { name: labels.menuLabel })
		).toHaveFocus();
	}
};

const bulkLabels = (count: number) => ({
	region: 'Case selection',
	selected: `${count} selected`,
	continueLabel: 'Continue',
	cancel: 'Cancel',
	emptyHint: 'Select at least one case.'
});

const PHONE_CASES: {
	title: string;
	state: CaseHandoverActionState;
	active?: boolean;
	selected?: boolean;
}[] = [
	{ title: 'Beratungsfall 4711', state: 'requestAccess', active: true },
	{ title: 'Beratungsfall 4712', state: 'requestAccess', selected: true },
	{ title: 'Beratungsfall 4713', state: 'requestAccess', selected: true },
	{ title: 'Beratungsfall 4714', state: 'awaitingApproval' },
	{ title: 'Beratungsfall 4715', state: 'accessGranted' }
];

/** Selection board on a phone: cards plus the sticky bulk bar. */
function PhoneSelectionBoard({ width }: { width: number }) {
	const [selected, setSelected] = useState(
		() =>
			new Set(
				PHONE_CASES.filter((item) => item.selected).map(
					(item) => item.title
				)
			)
	);
	return (
		<div
			data-testid="phone-frame"
			style={{
				width,
				height: 640,
				display: 'flex',
				flexDirection: 'column',
				background: '#eae7e8',
				overflow: 'hidden'
			}}
		>
			<div
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: 'auto',
					display: 'grid',
					alignContent: 'start',
					gap: 8,
					padding: '8px 0'
				}}
			>
				{PHONE_CASES.map((item) => (
					<DemoCard
						key={item.title}
						title={item.title}
						active={item.active}
					>
						<CaseHandoverActionButton
							labels={labels}
							state={item.state}
							batchMode
							selected={selected.has(item.title)}
							onToggleSelect={() =>
								setSelected((current) => {
									const next = new Set(current);
									if (next.has(item.title)) {
										next.delete(item.title);
									} else {
										next.add(item.title);
									}
									return next;
								})
							}
						/>
					</DemoCard>
				))}
			</div>
			<CaseHandoverBulkBar
				count={selected.size}
				labels={bulkLabels(selected.size)}
				onContinue={() => {}}
				onCancel={() => setSelected(new Set())}
			/>
		</div>
	);
}

const assertFitsPhone = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const frame = canvas.getByTestId('phone-frame').getBoundingClientRect();
	const frameRight = frame.right;
	const frameLeft = frame.left;
	for (const action of Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="case-handover-action"]'
		)
	)) {
		const box = action.getBoundingClientRect();
		await expect(box.right).toBeLessThanOrEqual(frameRight + 0.5);
		await expect(box.left).toBeGreaterThanOrEqual(frameLeft - 0.5);
	}
	const bar = canvas.getByRole('region', { name: 'Case selection' });
	const cancel = within(bar).getByRole('button', { name: 'Cancel' });
	const next = within(bar).getByRole('button', { name: 'Continue' });
	const cancelRight = cancel.getBoundingClientRect().right;
	const nextLeft = next.getBoundingClientRect().left;
	const nextRight = next.getBoundingClientRect().right;
	await expect(cancelRight).toBeLessThanOrEqual(nextLeft);
	await expect(nextRight).toBeLessThanOrEqual(frameRight + 0.5);
	await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
};

export const PhoneSelection390: Story = {
	name: 'Phone 390 — selection with bulk bar',
	render: () => <PhoneSelectionBoard width={390} />,
	play: async ({ canvasElement }) => {
		await assertFitsPhone(canvasElement);
		const canvas = within(canvasElement);
		await expect(canvas.getByText('2 selected')).toBeVisible();
		const second = within(
			canvas.getByTestId('card-Beratungsfall 4712')
		).getByRole('checkbox');
		await userEvent.click(second);
		await expect(canvas.getByText('1 selected')).toBeVisible();
		await userEvent.click(second);
		await expect(canvas.getByText('2 selected')).toBeVisible();
		second.blur();
	}
};

export const PhoneSelection320: Story = {
	name: 'Phone 320 — selection with bulk bar',
	render: () => <PhoneSelectionBoard width={320} />,
	play: async ({ canvasElement }) => assertFitsPhone(canvasElement)
};
