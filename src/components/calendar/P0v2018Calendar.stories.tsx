/**
 * Storybook page "P0 v2.0.18" (ORISO-Frontend#2494), sections *2 and *3:
 * the design Frank approves before the logic. Built only from the real
 * calendar components and the sample data of "Templates/Calendar/Meine
 * Termine", so what is shown here is what ships.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import CalendarPageStories from './CalendarPage.stories';
import { NewEntryDialog } from './NewEntryDialog';
import { SlotMenuContent } from './calendarMenus';
import { ChatMenuDropdown } from '../chatMenuDropdown/ChatMenuDropdown';
import type { CalendarEntry } from './calendarModel';
import { phone390Globals } from '../message/messageStoryShell';
import type { ConsultationHours } from './calendarConsultationHours';
import './calendar.styles';

const Harness = CalendarPageStories.component!;

const meta: Meta<typeof Harness> = {
	title: 'P0 v2.0.18/*2 *3 Meine Termine und Sprechzeiten',
	component: Harness,
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/booking/events' },
		docs: {
			description: {
				component:
					'ORISO-Frontend#2494 *2 and *3 (Staging v2.0.17 findings, decisions of 23 Nov 2026). *2a: links without appointment are compact rows (small medium icon, name, topic, actions), no illustrated tiles. *2b: "Neuer Eintrag" has the tab "Sprechzeit" (same office hours as the Sprechstunden dialog); a weekday takes several windows ("+ Zeitfenster"); a stretch dragged in the grid can be released once ("Einmalig") with its own lead time ("Buchbar bis 30 Min. vorher"), also over a Sperrzeit (Frank, 23 Nov, round 2). The red round "+" next to "Links ohne Termin" is gone. *2c: advice seekers see "Freie Sprechzeiten" beside "Meine Termine", the same size, only while their counsellor offers office hours; stacked on the phone. *3: office hours are a background band in the counsellor\'s time grid; an appointment over it takes that time out of the advice seekers\' free times (UserService `CounsellorFreeTime`).'
			}
		}
	},
	args: { role: 'consultant', scope: 'AGENCY', showUsernames: false }
};
export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_HOURS: ConsultationHours = {
	windows: [
		{ weekday: 2, start: '09:00', end: '12:00' },
		{ weekday: 2, start: '16:00', end: '18:00' },
		{ weekday: 4, start: '14:00', end: '17:00' }
	],
	autoAccept: true,
	noticeDays: 2,
	slotMinutes: 60
};

const linksBox = (el: HTMLElement) =>
	waitFor(() => {
		const box = el.querySelector<HTMLElement>('[data-cy="calendar-links"]');
		expect(box).not.toBeNull();
		return box!;
	});

/** *2a/*2b: compact rows, no illustration, no create button. */
const expectCompactLinks = async (el: HTMLElement) => {
	const box = await linksBox(el);
	await waitFor(() =>
		expect(
			box.querySelectorAll('[data-testid="direct-link-row"]').length
		).toBeGreaterThanOrEqual(3)
	);
	await expect(box.querySelector('.directLinkTile')).toBeNull();
	await expect(
		box.querySelector('[data-testid="direct-links-create"]')
	).toBeNull();
};

export const MeineTermineDesktop: Story = {
	name: '*2a Berater:in — Meine Termine, Links als Zeilen (Desktop)',
	args: { initialView: 'unset', links: true },
	play: async ({ canvasElement }) => expectCompactLinks(canvasElement)
};

export const MeineTerminePhone: Story = {
	name: '*2a Berater:in — Meine Termine, Links als Zeilen (Handy 390 px)',
	args: { initialView: 'list', links: true, compact: true, phone: true },
	globals: phone390Globals,
	play: async ({ canvasElement }) => expectCompactLinks(canvasElement)
};

const dialogArgs = {
	open: true,
	initialTab: 'consultation' as const,
	conversations: [{ sessionId: 7, username: 'mutige_eule' }],
	entries: [],
	ownerId: 'me',
	now: new Date(2026, 10, 23, 9, 0),
	consultationHours: SAMPLE_HOURS,
	onSaveAppointment: fn(),
	onSaveBlocker: fn(),
	onSaveAbsence: fn(),
	onSaveConsultationHours: fn(),
	onSaveOneOffConsultation: fn(),
	onClose: fn()
};

/** A Sperrzeit on Tuesday 24 Nov, 14–16, under the one-off below. */
const BLOCKER: CalendarEntry = {
	id: 'b1',
	type: 'blocker',
	ownerId: 'me',
	title: 'Teamsitzung',
	start: new Date(2026, 10, 24, 14).toISOString(),
	end: new Date(2026, 10, 24, 16).toISOString()
};

/** *2b: the tab "Sprechzeit" with the Sprechstunden form. */
const expectSprechzeitTab = async () => {
	const body = within(document.body);
	const tab = await body.findByRole('tab', { name: 'Sprechzeit' });
	await expect(tab).toHaveAttribute('aria-selected', 'true');
	await expect(body.getAllByRole('tab').map((t) => t.textContent)).toEqual([
		'Termin',
		'Sprechzeit',
		'Sperrzeit',
		'Abwesenheit'
	]);
	await expect(
		await body.findByTestId('consultation-hours-save')
	).toBeTruthy();
	// Tuesday holds two windows; "+" adds a third.
	await expect(body.getByTestId('consultation-window-2-1')).toBeTruthy();
	await expect(
		body.getByRole('radio', { name: 'Jede Woche' })
	).toHaveAttribute('aria-checked', 'true');
};

export const NeuerEintragSprechzeit: StoryObj<typeof NewEntryDialog> = {
	name: '*2b Neuer Eintrag — Tab „Sprechzeit“ (Desktop)',
	render: () => <NewEntryDialog {...dialogArgs} />,
	play: expectSprechzeitTab
};

export const NeuerEintragSprechzeitPhone: StoryObj<typeof NewEntryDialog> = {
	name: '*2b Neuer Eintrag — Tab „Sprechzeit“ (Handy 390 px)',
	render: () => <NewEntryDialog {...dialogArgs} fullScreen />,
	globals: phone390Globals,
	play: expectSprechzeitTab
};

/** *2b (Frank, 23 Nov): a stretch in the grid → "Eintragen als" → Sprechzeit. */
export const RasterSprechzeitMenue: StoryObj = {
	name: '*2b Kalender — Zeitraum ziehen → „Sprechzeit“ im Menü',
	render: () => (
		<div style={{ padding: 24 }}>
			<ChatMenuDropdown
				density="compact"
				role="menu"
				ariaLabel="Eintragen"
				style={{ width: 300 }}
			>
				<SlotMenuContent
					range={{
						start: new Date(2026, 10, 24, 14, 0),
						end: new Date(2026, 10, 24, 15, 0)
					}}
					onChoose={fn()}
					onConsultation={fn()}
				/>
			</ChatMenuDropdown>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			await within(canvasElement).findByText('Sprechzeit')
		).toBeTruthy();
	}
};

const onceArgs = {
	...dialogArgs,
	entries: [BLOCKER],
	slot: {
		start: new Date(2026, 10, 24, 14, 0),
		end: new Date(2026, 10, 24, 15, 0)
	}
};

/** *2b: "Einmalig" with its own lead time, over a Sperrzeit. */
const expectOnce = async () => {
	const body = within(document.body);
	await expect(
		await body.findByRole('radio', { name: 'Einmalig' })
	).toHaveAttribute('aria-checked', 'true');
	await expect(
		body.getByTestId('consultation-once-over-blocker')
	).toBeTruthy();
	await expect(body.getByTestId('consultation-once-save')).toBeEnabled();
};

export const SprechzeitEinmalig: StoryObj<typeof NewEntryDialog> = {
	name: '*2b Sprechzeit einmalig, kurzfristig (Desktop)',
	render: () => <NewEntryDialog {...onceArgs} />,
	play: expectOnce
};

export const SprechzeitEinmaligPhone: StoryObj<typeof NewEntryDialog> = {
	name: '*2b Sprechzeit einmalig, kurzfristig (Handy 390 px)',
	render: () => <NewEntryDialog {...onceArgs} fullScreen />,
	globals: phone390Globals,
	play: expectOnce
};

/** *2c: "Freie Sprechzeiten" beside "Meine Termine". */
const expectFreeTimes = async (el: HTMLElement) => {
	const canvas = within(el);
	const panel = await canvas.findByTestId('calendar-free-times');
	await expect(
		within(panel).getByRole('heading', { name: 'Freie Sprechzeiten' })
	).toBeTruthy();
	await expect(
		await within(panel).findByTestId('calendar-free-times-book')
	).toBeTruthy();
};

export const RatsuchendeDesktop: Story = {
	name: '*2c Ratsuchende — Meine Termine + Freie Sprechzeiten (Desktop)',
	args: {
		role: 'asker',
		withProposals: false,
		initialView: 'list',
		freeTimes: true
	},
	play: async ({ canvasElement }) => {
		await expectFreeTimes(canvasElement);
		// The same size: both columns share the room equally.
		const stage = canvasElement
			.querySelector('.calendarStage')!
			.getBoundingClientRect();
		const beside = canvasElement
			.querySelector('.calendarPage__beside')!
			.getBoundingClientRect();
		await expect(Math.abs(stage.width - beside.width)).toBeLessThan(2);
	}
};

export const RatsuchendePhone: Story = {
	name: '*2c Ratsuchende — gestapelt (Handy 390 px)',
	args: {
		role: 'asker',
		withProposals: false,
		initialView: 'list',
		freeTimes: true,
		compact: true,
		phone: true
	},
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		await expectFreeTimes(canvasElement);
		const stage = canvasElement
			.querySelector('.calendarStage')!
			.getBoundingClientRect();
		const beside = canvasElement
			.querySelector('.calendarPage__beside')!
			.getBoundingClientRect();
		await expect(beside.top).toBeGreaterThanOrEqual(stage.bottom - 1);
	}
};

export const RatsuchendeOhneSprechzeiten: Story = {
	name: '*2c Ratsuchende — Berater:in ohne Sprechzeiten: kein Bereich',
	args: {
		role: 'asker',
		withProposals: false,
		initialView: 'list',
		freeTimes: 'none'
	},
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByTestId('calendar-view');
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.calendarPage__beside')
			).not.toBeVisible()
		);
		await expect(
			within(canvasElement).queryByTestId('calendar-free-times')
		).toBeNull();
	}
};

/** *3: the office hours (Tue 9–12, Thu 14–17) as bands in the grid. */
const expectBands = async (el: HTMLElement) => {
	await waitFor(() =>
		expect(
			el.querySelectorAll('[data-cy="calendar-consultation-band"]').length
		).toBeGreaterThanOrEqual(1)
	);
};

export const SprechstundenWocheDesktop: Story = {
	name: '*3 Berater:in — Sprechstunden als Band (Arbeitswoche, Desktop)',
	args: { initialView: 'workWeek' },
	play: async ({ canvasElement }) => expectBands(canvasElement)
};

export const SprechstundenWochePhone: Story = {
	name: '*3 Berater:in — Sprechstunden als Band (3 Tage, Handy 390 px)',
	args: { initialView: 'threeDays', compact: true, phone: true },
	globals: phone390Globals,
	play: async ({ canvasElement }) => expectBands(canvasElement)
};
