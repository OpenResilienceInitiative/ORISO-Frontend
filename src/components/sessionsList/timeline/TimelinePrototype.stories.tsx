import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';
import {
	RuntimeSessionProviders,
	seedMatrixRoom
} from '../../sessionsListItem/__storybook__/runtimeSessionCard';
import {
	TimelinePrototype,
	type TimelinePrototypeProps
} from './TimelinePrototype';
import {
	mockBookings,
	mockEntries,
	mockListItems,
	mockSessions,
	mockTopics,
	unmappedListItem
} from './timelineMock';

const meta = {
	title: 'Components/Session/List/Timeline prototype',
	component: TimelinePrototype,
	tags: ['autodocs'],
	decorators: [
		(Story) => {
			seedMatrixRoom(3);
			return (
				<RuntimeSessionProviders
					sessions={[
						...Object.values(mockListItems),
						unmappedListItem
					]}
					topics={mockTopics}
				>
					<Story />
				</RuntimeSessionProviders>
			);
		}
	],
	parameters: {
		layout: 'centered',
		router: { initialPath: '/sessions/consultant/sessionView' },
		docs: {
			description: {
				component:
					'ADR-021 / PR 2 — prototype only, not wired into the real list. ' +
					'Toolbar and cards are the real components; the prototype adds the future zone. ' +
					'Pull the handle under the filter chips to reveal upcoming appointments; it rests at ' +
					'closed / next appointment / half / almost all and cannot go past the last appointment. ' +
					'Controls: scroll model (two panes vs. one timeline), "Jetzt" variant, role.'
			}
		}
	},
	argTypes: {
		scrollModel: { control: 'inline-radio', options: ['panes', 'single'] },
		nowVariant: {
			control: 'inline-radio',
			options: ['line', 'handle', 'band']
		},
		role: { control: 'inline-radio', options: ['counsellor', 'asker'] }
	},
	args: {
		entries: mockEntries(),
		sessions: mockSessions,
		items: mockListItems,
		unmappedItem: unmappedListItem,
		role: 'counsellor',
		scrollModel: 'panes',
		nowVariant: 'line',
		listHeight: 520
	}
} satisfies Meta<typeof TimelinePrototype>;

export default meta;
type Story = StoryObj<typeof meta>;

const handleOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[role="separator"]')!;
const futureRows = (canvasElement: HTMLElement) => [
	...canvasElement.querySelectorAll<HTMLElement>(
		'[data-cy="timeline-future"] .tlp__row'
	)
];
/** The first stop: the next appointment, from its top edge to the handle. */
const nextStop = (canvasElement: HTMLElement) => {
	const last = futureRows(canvasElement).at(-1)!;
	return (last.parentElement as HTMLElement).offsetHeight - last.offsetTop;
};
const content = (row: HTMLElement) =>
	row.querySelector<HTMLElement>('.sessionsListItem__content')!;
const REST_OUTLINE = 'rgb(255, 180, 170)'; // --m3-primary-fixed-dim
const FOCUS_RING = 'rgb(204, 30, 28)'; // --m3-primary-container
const futureHeight = (canvasElement: HTMLElement) =>
	Math.round(
		canvasElement
			.querySelector<HTMLElement>('[data-cy="timeline-future"]')!
			.getBoundingClientRect().height
	);

/** Reveal by hand: closed → next → … → last appointment, never beyond. */
export const FutureHandle: Story = {
	name: 'Handle — rests at closed / next / half / almost all',
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		await expect(handle.getAttribute('aria-orientation')).toBe(
			'horizontal'
		);
		await expect(futureHeight(canvasElement)).toBe(0);

		handle.focus();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() =>
			expect(handle.getAttribute('aria-valuenow')).toBe(
				String(nextStop(canvasElement))
			)
		);

		// 22 dates + one booking without a room: the last stop shows all of them.
		await expect(futureRows(canvasElement)).toHaveLength(
			mockEntries().length
		);
		const max = Number(handle.getAttribute('aria-valuemax'));
		await expect(max).toBeGreaterThan(
			(mockEntries().length - 1) * nextStop(canvasElement)
		);

		await userEvent.keyboard('{End}');
		await waitFor(() =>
			expect(handle.getAttribute('aria-valuenow')).toBe(String(max))
		);
		// Past the last appointment it does not go.
		await userEvent.keyboard('{ArrowDown}');
		await expect(handle.getAttribute('aria-valuenow')).toBe(String(max));

		await userEvent.keyboard('{Home}');
		await waitFor(() =>
			expect(handle.getAttribute('aria-valuenow')).toBe('0')
		);
	}
};

/** A drag past the last appointment stretches a little and springs back on release. */
export const SpringBack: Story = {
	name: 'Handle — springs back past the last appointment',
	args: {
		entries: mockEntries([], [mockBookings[0]]),
		sessions: mockSessions
	},
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		const top = canvasElement
			.querySelector<HTMLElement>('[data-cy="timeline-future"]')!
			.getBoundingClientRect().top;
		// One appointment only: the area ends right after it.
		await waitFor(() => expect(futureRows(canvasElement)).toHaveLength(1));
		const max = Number(handle.getAttribute('aria-valuemax'));
		await expect(max).toBeGreaterThanOrEqual(nextStop(canvasElement));

		fireEvent.pointerDown(handle, {
			button: 0,
			pointerId: 1,
			clientY: top
		});
		fireEvent.pointerMove(document, { pointerId: 1, clientY: top + 600 });
		await waitFor(() => {
			const shown = futureHeight(canvasElement);
			expect(shown).toBeGreaterThan(max);
			expect(shown).toBeLessThanOrEqual(max + 32);
		});
		fireEvent.pointerUp(document, { pointerId: 1 });
		await waitFor(() => expect(futureHeight(canvasElement)).toBe(max));
	}
};

/** The twin: the clicked card holds the 2px ring, its room in the past the calm outline. */
export const TwinSelection: Story = {
	name: 'Twin entry — clicked one full, its room calm',
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		handle.focus();
		await userEvent.keyboard('{ArrowDown}');
		const next = futureRows(canvasElement).at(-1)!;
		await userEvent.click(content(next));
		const past = [
			...canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy="timeline-past"] .tlp__row'
			)
		];
		const room = past.find((row) =>
			row.textContent?.includes('ruhiges Yak Kim')
		)!;
		await waitFor(() =>
			expect(
				room.querySelector('.sessionsListItem--active')
			).not.toBeNull()
		);
		await waitFor(() =>
			expect(getComputedStyle(content(next)).borderTopColor).toBe(
				FOCUS_RING
			)
		);
		await expect(getComputedStyle(content(room)).borderTopColor).toBe(
			REST_OUTLINE
		);
		// Exactly one open room in the past list.
		await expect(
			past.filter((row) => row.querySelector('.sessionsListItem--active'))
		).toHaveLength(1);
	}
};

/** A filter closes the area down to what it still holds. */
export const FilterGroups: Story = {
	name: 'Filter Gruppen — fewer appointments, shorter reach',
	args: { initialFilter: 'group' },
	play: async ({ canvasElement }) => {
		// 16 group dates; the bookings and the one without a room need "Alle".
		await waitFor(() => expect(futureRows(canvasElement)).toHaveLength(16));
		await expect(
			canvasElement.querySelectorAll(
				'[data-cy="timeline-past"] .tlp__row'
			)
		).toHaveLength(2);
	}
};

export const EmptyFuture: Story = {
	name: 'Nothing planned — handle stays closed',
	args: { entries: [], sessions: mockSessions },
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		await expect(handle.getAttribute('aria-valuemax')).toBe('0');
		handle.focus();
		await userEvent.keyboard('{ArrowDown}');
		await expect(handle.getAttribute('aria-valuenow')).toBe('0');
	}
};

const Variants = (props: Partial<TimelinePrototypeProps>) => (
	<div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
		{(['line', 'handle', 'band'] as const).map((nowVariant) => (
			<div key={nowVariant}>
				<p
					style={{
						font: '600 13px Inter, system-ui',
						margin: '0 0 8px'
					}}
				>
					Jetzt · {nowVariant}
				</p>
				<TimelinePrototype
					entries={mockEntries()}
					sessions={mockSessions}
					items={mockListItems}
					unmappedItem={unmappedListItem}
					listHeight={420}
					nowVariant={nowVariant}
					{...props}
				/>
			</div>
		))}
	</div>
);

export const NowVariants: Story = {
	name: '"Jetzt" — line with pill / handle label / band with arrows',
	parameters: { layout: 'padded' },
	render: () => <Variants />
};

export const SingleTimeline: Story = {
	name: 'Scroll model b — one timeline (pull past the top to release)',
	args: { scrollModel: 'single', listHeight: 360 }
};
