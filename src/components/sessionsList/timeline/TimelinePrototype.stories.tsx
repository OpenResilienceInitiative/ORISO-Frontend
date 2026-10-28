import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import {
	ENTRY_HEIGHT,
	TimelinePrototype,
	type TimelinePrototypeProps
} from './TimelinePrototype';
import { mockBookings, mockEntries, mockSessions } from './timelineMock';

const meta = {
	title: 'Components/Session/List/Timeline prototype',
	component: TimelinePrototype,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'ADR-021 / PR 2 — prototype only, not wired into the real list. ' +
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
				String(ENTRY_HEIGHT)
			)
		);

		// 22 dates + one booking without a room are in the future: the last stop is all of them.
		const max = Number(handle.getAttribute('aria-valuemax'));
		await expect(max).toBe(mockEntries().length * ENTRY_HEIGHT);

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
		await expect(handle.getAttribute('aria-valuemax')).toBe(
			String(ENTRY_HEIGHT)
		);

		fireEvent.pointerDown(handle, {
			button: 0,
			pointerId: 1,
			clientY: top
		});
		fireEvent.pointerMove(document, { pointerId: 1, clientY: top + 600 });
		await waitFor(() => {
			const shown = futureHeight(canvasElement);
			expect(shown).toBeGreaterThan(ENTRY_HEIGHT);
			expect(shown).toBeLessThanOrEqual(ENTRY_HEIGHT + 32);
		});
		fireEvent.pointerUp(document, { pointerId: 1 });
		await waitFor(() =>
			expect(futureHeight(canvasElement)).toBe(ENTRY_HEIGHT)
		);
	}
};

/** The twin: the clicked entry gets the full state, its room the calm outline. */
export const TwinSelection: Story = {
	name: 'Twin entry — clicked one full, its room calm',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		handleOf(canvasElement).focus();
		await userEvent.keyboard('{End}');
		const entry = canvasElement.querySelector<HTMLElement>(
			'[data-entry-key="occ-9001-0"]'
		)!;
		await userEvent.click(entry);
		await waitFor(() => expect(entry.dataset.selected).toBe('true'));
		const room = canvas
			.getAllByRole('tab')
			.find(
				(tab) =>
					tab.textContent?.includes('Elternrunde') &&
					tab.classList.contains('tlp__card')
			)!;
		await expect(room.classList.contains('tlp__card--calm')).toBe(true);
		// The other dates of the same series stay quiet apart from the calm outline.
		await expect(
			canvasElement
				.querySelector('[data-entry-key="occ-9001-1"]')!
				.classList.contains('tlp__entry--calm')
		).toBe(true);
		await expect(
			canvasElement
				.querySelector('[data-entry-key="occ-9002-0"]')!
				.classList.contains('tlp__entry--none')
		).toBe(true);
	}
};

/** A filter closes the area down to what it still holds. */
export const FilterOneToOne: Story = {
	name: 'Filter 1:1 — fewer appointments, shorter reach',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: '1:1' }));
		await waitFor(() =>
			// two bookings with a room; the one without a room needs "Alle"
			expect(handleOf(canvasElement).getAttribute('aria-valuemax')).toBe(
				String(2 * ENTRY_HEIGHT)
			)
		);
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
