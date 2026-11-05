import * as React from 'react';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';
import {
	RuntimeSessionProviders,
	seedMatrixRoom
} from '../../sessionsListItem/__storybook__/runtimeSessionCard';
import { TimelinePrototype } from './TimelinePrototype';
import {
	MOCK_NOW,
	mockBookings,
	mockEntries,
	mockListItems,
	mockSessions,
	mockTopics,
	playgroundEntries
} from './timelineMock';
import type { TimelineBooking } from './timelineModel';

const meta = {
	title: 'Components/Session/List/Timeline prototype',
	component: TimelinePrototype,
	tags: ['autodocs'],
	decorators: [
		(Story, { parameters }) => {
			if (!parameters.ownMatrixSeed) seedMatrixRoom(3);
			return (
				<RuntimeSessionProviders
					sessions={Object.values(mockListItems)}
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
					'ADR-021. Toolbar, cards, appointment row and future zone are the real components. ' +
					'Grab "Jetzt" and pull down to reveal the appointments as pills; it rests at ' +
					'closed / next appointment / half / almost all and never goes past the last one. ' +
					'A click on a pill opens the room, a right click or a long press opens the menu.'
			}
		}
	},
	argTypes: {
		scrollModel: { control: 'inline-radio', options: ['panes', 'single'] },
		role: { control: 'inline-radio', options: ['counsellor', 'asker'] },
		pastDate: {
			control: 'inline-radio',
			options: ['corner', 'line', 'off']
		},
		rowButtonSize: {
			control: 'inline-radio',
			options: ['xsmall', 'compact']
		}
	},
	args: {
		entries: mockEntries(),
		sessions: mockSessions,
		items: mockListItems,
		role: 'counsellor',
		scrollModel: 'panes',
		pastDate: 'corner',
		rowButtonSize: 'xsmall',
		listHeight: 520,
		now: MOCK_NOW
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
const pastRow = (canvasElement: HTMLElement, name: string) =>
	[
		...canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="timeline-past"] .tlp__row'
		)
	].find((row) => row.textContent?.includes(name))!;

const content = (row: HTMLElement) =>
	row.querySelector<HTMLElement>('.sessionsListItem__content')!;
const futureHeight = (canvasElement: HTMLElement) =>
	Math.round(
		canvasElement
			.querySelector<HTMLElement>('[data-cy="timeline-future"]')!
			.getBoundingClientRect().height
	);

const WIDTHS = [
	{ value: 80, label: '80 ultra-dünn' },
	{ value: 220, label: '220 schmal' },
	{ value: 340, label: '340 eng' },
	{ value: 397, label: '397 normal' },
	{ value: 500, label: '500 breit' }
];
const NEXT_IN = [
	{ value: -10, label: 'läuft gerade' },
	{ value: 3, label: 'in 3 Min (rot)' },
	{ value: 25, label: 'in 25 Min' },
	{ value: 60 * 26, label: 'morgen' },
	{ value: 60 * 24 * 5, label: 'in 5 Tagen' }
];

const Choice = <T extends string | number>({
	label,
	value,
	options,
	onChange
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) => (
	<div
		role="group"
		aria-label={label}
		style={{
			display: 'flex',
			flexWrap: 'wrap',
			alignItems: 'center',
			gap: 4
		}}
	>
		<span style={{ width: 96, font: '500 12px/16px Inter, system-ui' }}>
			{label}
		</span>
		{options.map((option) => (
			<button
				key={option.value}
				type="button"
				aria-pressed={option.value === value}
				onClick={() => onChange(option.value)}
				style={{
					padding: '4px 10px',
					border: '1px solid #c4c7c8',
					borderRadius: 14,
					background: option.value === value ? '#646d78' : '#fff',
					color: option.value === value ? '#fff' : '#1b1b1c',
					font: '12px/16px Inter, system-ui',
					cursor: 'pointer'
				}}
			>
				{option.label}
			</button>
		))}
	</div>
);

const Playground = () => {
	const [rowButtonSize, setRowButtonSize] = useState<'xsmall' | 'compact'>(
		'xsmall'
	);
	const [width, setWidth] = useState(397);
	const [nextIn, setNextIn] = useState(25);
	const [amount, setAmount] = useState(6);
	const [people, setPeople] = useState(23);
	const [unread, setUnread] = useState(0);
	const entries = useMemo(
		() => playgroundEntries(nextIn, amount),
		[nextIn, amount]
	);
	useMemo(() => seedMatrixRoom(unread, people), [unread, people]);
	return (
		<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
					width: 420
				}}
			>
				<Choice
					label="Knopf auf Karte"
					value={rowButtonSize}
					options={[
						{ value: 'xsmall', label: 'XSmall 32' },
						{ value: 'compact', label: 'Small 40' }
					]}
					onChange={setRowButtonSize}
				/>
				<Choice
					label="Listenbreite"
					value={width}
					options={WIDTHS}
					onChange={setWidth}
				/>
				<Choice
					label="Nächster Termin"
					value={nextIn}
					options={NEXT_IN}
					onChange={setNextIn}
				/>
				<Choice
					label="Anzahl Termine"
					value={amount}
					options={[1, 3, 6, 16].map((value) => ({
						value,
						label: String(value)
					}))}
					onChange={setAmount}
				/>
				<Choice
					label="Personen im Kreis"
					value={people}
					options={[3, 4, 5, 23].map((value) => ({
						value,
						label: String(value)
					}))}
					onChange={setPeople}
				/>
				<Choice
					label="Ungelesen"
					value={unread}
					options={[
						{ value: 0, label: 'nein' },
						{ value: 3, label: 'ja' }
					]}
					onChange={setUnread}
				/>
			</div>
			<TimelinePrototype
				key={`${people}-${unread}`}
				entries={entries}
				sessions={mockSessions}
				items={mockListItems}
				rowButtonSize={rowButtonSize}
				width={width}
				listHeight={620}
			/>
		</div>
	);
};

/** Frank's test bench: click, select and deselect, pull "Jetzt" up and down. */
export const ZumAusprobieren: Story = {
	name: 'Zum Ausprobieren',
	parameters: { layout: 'padded', ownMatrixSeed: true },
	render: () => <Playground />
};

/** Frank's preview: the same real cards with both button heights. */
export const RowButtonBothSizes: Story = {
	name: 'Knopf auf der Karte — XSmall und Small nebeneinander',
	parameters: { layout: 'padded' },
	render: (args) => (
		<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
			{(['xsmall', 'compact'] as const).map((rowButtonSize) => (
				<TimelinePrototype
					key={rowButtonSize}
					{...args}
					rowButtonSize={rowButtonSize}
					width={397}
				/>
			))}
		</div>
	)
};

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

		// More dates than fit: the zone stops at 85 % of the list and scrolls inside.
		await expect(futureRows(canvasElement)).toHaveLength(
			mockEntries().length
		);
		const max = Number(handle.getAttribute('aria-valuemax'));
		await expect(max).toBe(442);

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

/** A click opens the appointment's room, a second click lets go of it. */
export const PillSelection: Story = {
	name: 'Pill — click selects and opens the room, second click deselects',
	play: async ({ canvasElement }) => {
		handleOf(canvasElement).focus();
		await userEvent.keyboard('{ArrowDown}');
		const next = futureRows(canvasElement).at(-1)!;
		const pill = next.querySelector<HTMLElement>(
			'[data-cy="timeline-entry"]'
		)!;
		await userEvent.click(pill);
		const room = () =>
			pastRow(canvasElement, 'ruhiges Yak Kim').querySelector(
				'.sessionsListItem--active'
			);
		await waitFor(() => expect(room()).not.toBeNull());
		await expect(pill.getAttribute('aria-current')).toBe('true');
		await userEvent.click(pill);
		await waitFor(() => expect(room()).toBeNull());
		await expect(pill.getAttribute('aria-current')).toBeNull();
	}
};

/** The menu sits on the context menu and, on touch, on a long press. */
export const PillMenu: Story = {
	name: 'Pill — right click opens the appointment menu',
	play: async ({ canvasElement }) => {
		handleOf(canvasElement).focus();
		await userEvent.keyboard('{ArrowDown}');
		const pill = futureRows(canvasElement)
			.at(-1)!
			.querySelector<HTMLElement>('[data-cy="timeline-entry"]')!;
		fireEvent.contextMenu(pill);
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="timeline-entry-menu"]')
			).not.toBeNull()
		);
		await userEvent.keyboard('{Escape}');
	}
};

const IN_MINUTES = (minutes: number) =>
	new Date(MOCK_NOW.getTime() + minutes * 60_000).toISOString();
const booking = (id: number, startTime: string): TimelineBooking => ({
	id,
	startTime,
	endTime: IN_MINUTES(240),
	location: 'VIDEO_CALL',
	sessionId: 4401
});

/** The queue: quiet until five minutes before, then red; "läuft" until it ends. */
export const SoonAndRunning: Story = {
	name: 'Pill — red from five minutes before, "läuft" while it runs',
	args: {
		entries: mockEntries(
			[],
			[
				booking(1, IN_MINUTES(-10)),
				booking(2, IN_MINUTES(3)),
				booking(3, IN_MINUTES(25)),
				booking(4, IN_MINUTES(60 * 26)),
				{
					...booking(5, IN_MINUTES(60 * 24 * 5)),
					location: 'IN_PERSON',
					sessionId: undefined
				}
			]
		)
	},
	play: async ({ canvasElement }) => {
		const pills = () =>
			[
				...canvasElement.querySelectorAll<HTMLElement>(
					'[data-cy="timeline-entry"]'
				)
			].reverse();
		await waitFor(() => expect(pills()).toHaveLength(5));
		const when = (pill: HTMLElement) =>
			pill.querySelector('[data-cy="timeline-entry-when"]')?.textContent;
		const [running, soon, later, tomorrow, walkIn] = pills();
		await expect(when(running)).toBe('läuft');
		await expect(running.classList).toContain('tlp__entry--soon');
		await expect(when(soon)).toMatch(/3/);
		await expect(soon.classList).toContain('tlp__entry--soon');
		await expect(when(later)).toMatch(/25/);
		await expect(later.classList).not.toContain('tlp__entry--soon');
		await expect(when(tomorrow)).toBe('morgen');
		await expect(walkIn.dataset.unmapped).toBe('true');
		// Without a room a click has nothing to open: the menu instead.
		await userEvent.click(walkIn);
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="timeline-entry-menu"]')
			).not.toBeNull()
		);
		await userEvent.keyboard('{Escape}');
	}
};

/** A card with a planned date: the row below its text, the kind beside the button. */
export const CardAppointmentRow: Story = {
	name: 'Card — next appointment as a row, symbol when too narrow',
	play: async ({ canvasElement }) => {
		const row = pastRow(canvasElement, 'Elternrunde');
		const appointment = () =>
			row.querySelector<HTMLElement>(
				'[data-cy="session-card-appointment"]'
			);
		await waitFor(() => expect(appointment()).not.toBeNull());
		const button = appointment()!.querySelector<HTMLElement>(
			'.splitButton--xsmall'
		)!;
		await expect(
			Math.round(button.getBoundingClientRect().width)
		).toBeGreaterThan(240);
		const clock = row.querySelector<HTMLElement>(
			'[data-cy="upcoming-appointment-clock"]'
		)!;
		await expect(getComputedStyle(clock).display).toBe('none');
		// Mail counselling (last row) has nothing planned.
		const rows = canvasElement.querySelectorAll<HTMLElement>(
			'[data-cy="timeline-past"] .tlp__row'
		);
		await expect(
			rows[rows.length - 1].querySelector(
				'[data-cy="session-card-appointment"]'
			)
		).toBeNull();
	}
};

export const CardTooNarrowForRow: Story = {
	name: 'Card — 300px wide: calendar symbol with the date as tooltip',
	args: { width: 300 },
	play: async ({ canvasElement }) => {
		const row = pastRow(canvasElement, 'ruhiges Yak Kim');
		await waitFor(() =>
			expect(
				row.querySelector('[data-cy="upcoming-appointment-clock"]')
			).not.toBeNull()
		);
		const clock = row.querySelector<HTMLElement>(
			'[data-cy="upcoming-appointment-clock"]'
		)!;
		await expect(getComputedStyle(clock).display).not.toBe('none');
		await expect(clock.getAttribute('title')).toBe(
			'Nächster Termin: Do 29. Okt 16:00'
		);
		await expect(
			getComputedStyle(
				row.querySelector('[data-cy="session-card-appointment"]')!
			).display
		).toBe('none');
	}
};

/** The ultra-thin list: the appointment's kind as a mark, the date is its tooltip. */
export const RailCalendarMark: Story = {
	name: 'Ultra-thin list — appointment kind on the pill',
	args: { width: 80 },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll(
					'.sessionRailPill__mark--appointment'
				).length
			).toBeGreaterThan(0)
		);
		// Stands out from the quiet marks and shows the kind, not a plain calendar.
		const mark = canvasElement.querySelector<HTMLElement>(
			'.sessionRailPill__mark--appointment'
		)!;
		await expect(getComputedStyle(mark).color).toBe('rgb(255, 255, 255)');
		await expect(mark.querySelector('svg')).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="timeline-future"]')
		).toBeNull();
	}
};

/** Above three people one circle with the people and their count; its colours follow the ring. */
export const CrowdField: Story = {
	name: 'Card — above three people the count circle',
	parameters: { ownMatrixSeed: true },
	render: (args) => {
		seedMatrixRoom(0, 23);
		return <TimelinePrototype {...args} />;
	},
	play: async ({ canvasElement }) => {
		const circle = () =>
			pastRow(canvasElement, 'Elternrunde').querySelector<HTMLElement>(
				'[data-cy="group-card-crowd"]'
			)!;
		const colours = () => {
			const { backgroundColor, color } = getComputedStyle(circle());
			return [backgroundColor, color];
		};
		await waitFor(() => expect(circle()?.textContent).toBe('23'));
		await waitFor(() => {
			const box = circle().getBoundingClientRect();
			expect([box.width, box.height]).toEqual([48, 48]);
		});
		await expect(circle().querySelector('svg')).not.toBeNull();
		await waitFor(() =>
			expect(colours()).toEqual(['rgb(255, 255, 255)', 'rgb(27, 27, 28)'])
		);
		// Open with the focus on the card: primary.
		await userEvent.click(circle());
		await waitFor(() =>
			expect(colours()).toEqual(['rgb(165, 0, 10)', 'rgb(255, 255, 255)'])
		);
		// Focus elsewhere: accent and dark red.
		(document.activeElement as HTMLElement).blur();
		await waitFor(() =>
			expect(colours()).toEqual(['rgb(255, 218, 213)', 'rgb(147, 0, 8)'])
		);
	}
};

/**
 * Figma 115:27131: the open card is Selected while the focus is on it and
 * Secondary Selected while it is elsewhere (typing field, a menu in the chat).
 * Hover needs a real pointer, so the real-build run covers that state.
 */
export const OpenCardFollowsTheFocus: Story = {
	name: 'Card — Selected with the focus, Secondary Selected without',
	play: async ({ canvasElement }) => {
		const row = () => pastRow(canvasElement, 'Elternrunde');
		const part = (selector: string) =>
			getComputedStyle(row().querySelector<HTMLElement>(selector)!);
		const state = () => ({
			card: part('.sessionsListItem__content').backgroundColor,
			chip: part('.sessionsListItem__topic').backgroundColor,
			chipText: part('.sessionsListItem__topic').color,
			kind: part('.sessionsListItem__consultingTypeIcon--kindIcon')
				.backgroundColor
		});
		await waitFor(() => expect(row()).toBeTruthy());
		await waitFor(() =>
			expect(
				row()
					.querySelector<HTMLElement>('.sessionsListItem__topic')!
					.getBoundingClientRect().height
			).toBe(22)
		);
		await userEvent.click(
			row().querySelector<HTMLElement>('.sessionsListItem__topic')!
		);
		await waitFor(() =>
			expect(state()).toEqual({
				card: 'rgb(255, 255, 255)',
				chip: 'rgb(165, 0, 10)',
				chipText: 'rgb(255, 255, 255)',
				kind: 'rgb(147, 0, 8)'
			})
		);
		(document.activeElement as HTMLElement).blur();
		await waitFor(() =>
			expect(state()).toEqual({
				card: 'rgb(246, 243, 243)',
				chip: 'rgb(255, 180, 170)',
				chipText: 'rgb(65, 0, 1)',
				kind: 'rgb(77, 86, 96)'
			})
		);
	}
};

/** "Jetzt" is the grip: the word lives in the handle, in the accent colour. */
/** The search lies over the list, "Jetzt" included, and Escape folds it away. */
export const SearchLiesAboveNow: Story = {
	name: 'Search — lies above "Jetzt", Escape closes it',
	play: async ({ canvasElement }) => {
		const grip = await waitFor(() => {
			const found =
				canvasElement.querySelector<HTMLElement>('.tlp__nowGrip');
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const input = canvasElement.querySelector<HTMLInputElement>(
			'[data-cy="sessions-list-search"]'
		)!;
		await userEvent.click(input);
		const panel = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="session-search-panel"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const { left, width, top, height } = grip.getBoundingClientRect();
		await waitFor(() =>
			expect(
				panel.contains(
					document.elementFromPoint(
						left + width / 2,
						top + height / 2
					)
				)
			).toBe(true)
		);

		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="session-search-panel"]')
			).toBeNull()
		);
		await expect(document.activeElement).toBe(input);
	}
};

/** Like every other chip, the archive chip names itself once it is on. */
export const ArchiveChipShowsItsName: Story = {
	name: 'Archive chip — on shows its name',
	play: async ({ canvasElement }) => {
		const chip = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="sessions-list-chip-archive"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const label = chip.querySelector('.sessionsListToolbar__chipLabel')!;
		await expect(label.getAttribute('aria-hidden')).toBe('true');
		await userEvent.click(chip);
		await waitFor(() =>
			expect(chip.getAttribute('aria-current')).toBe('page')
		);
		await expect(label.getAttribute('aria-hidden')).toBe('false');
	}
};

export const NowIsTheGrip: Story = {
	name: '"Jetzt" — the handle itself, on a line that runs out',
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		const tag = handle.querySelector<HTMLElement>('.tlp__nowTag')!;
		await expect(tag.textContent).toBe('Jetzt');
		await expect(getComputedStyle(tag).backgroundColor).toBe(
			'rgb(255, 180, 170)'
		);
		await expect(getComputedStyle(handle).cursor).toBe('grab');
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

export const SingleTimeline: Story = {
	name: 'Scroll model b — one timeline (pull past the top to release)',
	args: { scrollModel: 'single', listHeight: 360 }
};

/** Switching chats keeps the handle where it is; a reload starts closed (FutureHandle). */
export const ChatSwitchKeepsHandle: Story = {
	name: 'Handle — stays put while switching chats',
	play: async ({ canvasElement }) => {
		const handle = handleOf(canvasElement);
		await expect(handle.getAttribute('aria-valuenow')).toBe('0');
		handle.focus();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() =>
			expect(handle.getAttribute('aria-valuenow')).toBe(
				String(nextStop(canvasElement))
			)
		);
		const opened = handle.getAttribute('aria-valuenow')!;
		await waitFor(() =>
			expect(futureHeight(canvasElement)).toBe(Number(opened))
		);

		await userEvent.click(content(pastRow(canvasElement, 'mutiger Fuchs')));
		await userEvent.click(
			content(pastRow(canvasElement, 'ruhiges Yak Kim'))
		);
		await waitFor(() =>
			expect(
				pastRow(canvasElement, 'ruhiges Yak Kim').querySelector(
					'.sessionsListItem--active'
				)
			).not.toBeNull()
		);
		await expect(handle.getAttribute('aria-valuenow')).toBe(opened);
		await expect(futureHeight(canvasElement)).toBe(Number(opened));
	}
};

/** Button and kind share one row, with the card's own side margins (Figma 316-16775). */
export const CardRowKindBesideButton: Story = {
	name: 'Appointment row — kind beside the button',
	play: async ({ canvasElement }) => {
		const row = await waitFor(() => {
			const found = canvasElement.querySelector(
				'.sessionsListItem--kindInRow [data-cy="session-card-appointment"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const middle = (element: Element) => {
			const { top, height } = element.getBoundingClientRect();
			return top + height / 2;
		};
		const button = row.querySelector('.splitButton')!;
		const kind = row.querySelector(
			'[data-cy="session-card-appointment-kind"]'
		)!;
		await expect(kind).toHaveTextContent('Kreis');
		const label = button.querySelector('.splitButton__label')!;
		await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
		await expect(
			Math.abs(middle(kind) - middle(button))
		).toBeLessThanOrEqual(1);
		// waitFor: cards scale in (0.98 → 1), which scales every measured length.
		await waitFor(() =>
			expect(
				button.getBoundingClientRect().left -
					row.getBoundingClientRect().left
			).toBe(16)
		);
		const card = row.closest('.sessionsListItem')!;
		const bodyKind = card.querySelector('.sessionCard__trailing')!;
		await expect(getComputedStyle(bodyKind).display).toBe('none');
	}
};

/** With an appointment row the preview ends after one line, the kind stays beside it. */
export const CardRowPreviewOneLine: Story = {
	name: 'Appointment row — preview ends after one line',
	play: async ({ canvasElement }) => {
		const card = await waitFor(() => {
			const found = canvasElement.querySelector(
				'.sessionsListItem--withAppointment .sessionCard'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const preview = card.querySelector(
			'.sessionCard__preview > *'
		) as HTMLElement;
		preview.textContent = 'Sehr langer Text. '.repeat(20);
		await waitFor(() =>
			expect(preview.getBoundingClientRect().height).toBe(16)
		);
		await expect(getComputedStyle(preview).textOverflow).toBe('ellipsis');
		// Without an appointment the same long text keeps its lines.
		const free = canvasElement.querySelector(
			'.sessionsListItem:not(.sessionsListItem--withAppointment) .sessionCard__preview > *'
		) as HTMLElement;
		free.textContent = 'Sehr langer Text. '.repeat(20);
		await expect(free.getBoundingClientRect().height).toBeGreaterThan(16);
		// The faces keep their full height (48): only the text ends early.
		// offsetHeight ignores the entrance transform, which shrinks the rect.
		await expect(
			(card.querySelector('.sessionCard__flow') as HTMLElement)
				.offsetHeight
		).toBeGreaterThanOrEqual(48);
	}
};

/** The card's menu closes by arrow and by Escape, and its frame stays whole. */
export const CardRowMenuCloses: Story = {
	name: 'Appointment row — menu closes by arrow and Escape',
	play: async ({ canvasElement }) => {
		const row = await waitFor(() => {
			const found = canvasElement.querySelector(
				'[data-cy="session-card-appointment"]'
			);
			expect(found).not.toBeNull();
			return found as HTMLElement;
		});
		const arrow = row.querySelectorAll('button')[1];
		const menu = () =>
			document.querySelector('[data-cy="timeline-entry-menu"]');
		await userEvent.click(arrow);
		await waitFor(() => expect(menu()).not.toBeNull());
		const entries = menu()!.querySelectorAll('[role="menuitem"]');
		await expect(entries.length).toBeGreaterThan(0);
		entries.forEach((entry) =>
			expect(
				entry.querySelector('.chatMenuDropdown__itemIcon svg')
			).not.toBeNull()
		);
		const frame = menu()!.getBoundingClientRect();
		await expect(frame.bottom).toBeLessThanOrEqual(window.innerHeight);
		await expect(frame.top).toBeGreaterThanOrEqual(0);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(menu()).toBeNull());
		await userEvent.click(arrow);
		await waitFor(() => expect(menu()).not.toBeNull());
		await userEvent.click(arrow);
		await waitFor(() => expect(menu()).toBeNull());
	}
};

/** Display setting "date": in the card's corner (default) or its own line, never in the topic tag. */
export const PastDateInCorner: Story = {
	name: 'Date on past cards — in the corner',
	play: async ({ canvasElement }) => {
		const row = pastRow(canvasElement, 'ruhiges Yak Kim');
		await waitFor(() =>
			expect(
				row.querySelector(
					'.sessionsListItem__rowRight .sessionsListItem__date'
				)
			).not.toBeNull()
		);
		await expect(row.querySelector('.topicTag')?.textContent).not.toMatch(
			/\d/
		);
		// Pills name their time themselves.
		await expect(
			canvasElement.querySelector(
				'[data-cy="timeline-future"] .sessionsListItem__date'
			)
		).toBeNull();
	}
};

export const PastDateOwnLine: Story = {
	name: 'Date on past cards — own line',
	args: { pastDate: 'line' },
	play: async ({ canvasElement }) => {
		const row = pastRow(canvasElement, 'ruhiges Yak Kim');
		await waitFor(() =>
			expect(
				row.querySelector('[data-cy="session-card-date-line"]')
			).not.toBeNull()
		);
		await expect(row.querySelector('.sessionsListItem__date')).toBeNull();
	}
};
