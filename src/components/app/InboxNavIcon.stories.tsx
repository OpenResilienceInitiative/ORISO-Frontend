import * as React from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { InboxNavIcon } from './InboxNavIcon';

const FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=10237-32622';

/**
 * Mirrors the nav slot: 48px tile with 12px padding, icon box 24px (phone)
 * or 32px (desktop, from the large breakpoint). Overflow stays visible, as in
 * the real slot, so a clipped circle would show here too.
 */
const Slot = ({
	size,
	active = false,
	children
}: {
	size: 24 | 32;
	active?: boolean;
	children: React.ReactNode;
}) => (
	<div
		style={{
			width: size + 24,
			height: size + 24,
			padding: 12,
			boxSizing: 'border-box',
			borderRadius: 12,
			background: active ? '#ffdad5' : '#f6f3f3',
			color: active ? '#930008' : '#1c1b1f',
			outline: '1px dashed #c9c5c5',
			outlineOffset: -1
		}}
	>
		<div style={{ width: size, height: size }}>{children}</div>
	</div>
);

type Cell = {
	title: string;
	total: number;
	unopened: number;
	overdue?: boolean;
};

const CELLS: Cell[] = [
	{ title: 'Empty', total: 0, unopened: 0 },
	{ title: 'All opened', total: 6, unopened: 0 },
	{ title: 'One unopened', total: 6, unopened: 1 },
	{ title: '2 unopened', total: 6, unopened: 2 },
	{ title: '9 unopened', total: 12, unopened: 9 },
	{ title: '10 unopened (star)', total: 12, unopened: 10 },
	{ title: 'Overdue, none unopened', total: 6, unopened: 0, overdue: true },
	{ title: 'Overdue, 1 unopened', total: 6, unopened: 1, overdue: true },
	{ title: 'Overdue, 9 unopened', total: 12, unopened: 9, overdue: true },
	{
		title: 'Overdue, 10+ unopened (star)',
		total: 40,
		unopened: 25,
		overdue: true
	}
];

const Matrix = () => (
	<div
		style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
			gap: 16
		}}
	>
		{CELLS.map((cell) => (
			<figure
				key={cell.title}
				style={{
					margin: 0,
					padding: 12,
					border: '1px solid #e6e6e6',
					borderRadius: 12,
					display: 'grid',
					gap: 8,
					background: '#fff'
				}}
			>
				<figcaption style={{ font: '13px Arial', color: '#4c555f' }}>
					{cell.title}
				</figcaption>
				{[24, 32].map((size) => (
					<div
						key={size}
						style={{
							display: 'flex',
							gap: 12,
							alignItems: 'center'
						}}
					>
						<span style={{ font: '11px Arial', width: 34 }}>
							{size}px
						</span>
						<Slot size={size as 24 | 32}>
							<InboxNavIcon
								totalCount={cell.total}
								unopenedCount={cell.unopened}
								overdue={cell.overdue}
							/>
						</Slot>
						<Slot size={size as 24 | 32} active>
							<InboxNavIcon
								totalCount={cell.total}
								unopenedCount={cell.unopened}
								overdue={cell.overdue}
								variant="filled"
							/>
						</Slot>
					</div>
				))}
			</figure>
		))}
	</div>
);

const meta = {
	title: 'Components/Layout/InboxNavIcon',
	component: InboxNavIcon,
	tags: ['autodocs'],
	args: {
		totalCount: 6,
		unopenedCount: 5,
		overdue: false,
		variant: 'outline' as const
	},
	argTypes: {
		variant: { control: 'inline-radio', options: ['outline', 'filled'] }
	},
	parameters: {
		layout: 'padded',
		design: [
			{ type: 'figma', name: 'App.Oriso Frame 990', url: FIGMA_URL }
		],
		docs: {
			description: {
				component:
					'Presentational "Anfragen" nav icon. Counts in, state icon plus number circle out; nothing is fetched. Priority: overdue > more than nine (star) > two to nine (digit) > one (person) > all opened > empty. The circle is part of the SVG, so it scales with the 24px (phone) or 32px (desktop) slot. The exact count goes into the accessible name, also above nine.'
			}
		}
	}
} satisfies Meta<typeof InboxNavIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

// Story-level decorators add to meta-level ones, so the 32px desktop slot is set per single-icon
// story; the state matrix brings its own slots and needs the full canvas width.
const desktopSlot: Decorator = (Story) => (
	<Slot size={32}>
		<Story />
	</Slot>
);
const inDesktopSlot = { decorators: [desktopSlot] };

/** Every state at phone (24px) and desktop (32px) slot size, outline and active. */
export const AllStates: Story = {
	render: () => <Matrix />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvasElement.querySelectorAll('svg').length).toBe(
			CELLS.length * 4
		);
		await expect(
			canvasElement.querySelectorAll(
				'[data-testid="inbox-nav-icon-star"]'
			).length
		).toBe(2 * 4);
		await expect(canvas.getAllByRole('img').length).toBe(CELLS.length * 4);
		// The matrix uses the canvas width, not a 32px icon slot.
		await expect(
			(
				canvasElement.firstElementChild as HTMLElement
			).getBoundingClientRect().width
		).toBeGreaterThan(200);
	}
};

export const Empty: Story = {
	...inDesktopSlot,
	args: { totalCount: 0, unopenedCount: 0 }
};
export const AllOpened: Story = {
	...inDesktopSlot,
	args: { totalCount: 6, unopenedCount: 0 }
};
export const OneUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 6, unopenedCount: 1 }
};
export const TwoUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 6, unopenedCount: 2 }
};
export const NineUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 12, unopenedCount: 9 }
};
export const TenUnopenedStar: Story = {
	...inDesktopSlot,
	args: { totalCount: 12, unopenedCount: 10 }
};
export const OverdueNoneUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 6, unopenedCount: 0, overdue: true }
};
export const OverdueWithUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 12, unopenedCount: 3, overdue: true }
};
export const OverdueManyUnopened: Story = {
	...inDesktopSlot,
	args: { totalCount: 40, unopenedCount: 25, overdue: true }
};

/** Phone slot: 24px icon box. */
export const PhoneSlot: Story = {
	args: { totalCount: 12, unopenedCount: 9 },
	decorators: [
		(Story) => (
			<Slot size={24}>
				<Story />
			</Slot>
		)
	]
};
