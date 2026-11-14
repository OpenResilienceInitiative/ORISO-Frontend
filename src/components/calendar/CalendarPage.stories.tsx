import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within
} from 'storybook/test';
import { NavigationStoryShell } from '../app/NavigationStoryShell';
import { phone390Globals } from '../message/messageStoryShell';
import { CalendarPage, type CalendarLoadState } from './CalendarPage';
import { BlockerDialog } from './BlockerDialog';
import { WorkingHoursDialog } from './WorkingHoursDialog';
import {
	colleaguesInScope,
	redactForColleague,
	type AppointmentDraft,
	type CalendarEntry,
	type CalendarRole,
	type CalendarVisibilityScope
} from './calendarModel';
import {
	addProposal,
	withdrawProposal,
	type MoveProposal
} from './calendarActions';
import type { CalendarViewName, ViewSwitcherStyle } from './calendarViews';
import type { DayExceptions, WorkingHours } from './calendarWorkingHours';
import type { HolidayRegion } from './calendarHolidays';
import type { SplitDays } from './CalendarSplitView';
import type { SheetStop } from './CalendarSheet';
import {
	ASKER_ENTRIES,
	COLLEAGUE_ENTRIES,
	COLLEAGUES,
	CONVERSATIONS,
	FEED_URL,
	ME,
	OWN_ENTRIES,
	STORY_NOW,
	STORY_PROPOSALS,
	STORY_WORKING_HOURS
} from './calendarStoryData';

/**
 * Stand-in for the UserService container: keeps entries, working hours and
 * proposals in local state, so every click works, and applies the Träger's
 * visibility the way UserService does (only colleagues in scope, redacted
 * entries). Proposals and "Beitreten" have no backend yet; only Storybook
 * passes their callbacks.
 */
const Harness = ({
	role = 'consultant',
	scope = 'AGENCY',
	showUsernames = false,
	state = 'ready',
	empty = false,
	compact = false,
	initialView,
	shownColleagues = [],
	fullscreen = false,
	switcherStyle = 'menu',
	proposals: initialProposals = [],
	withProposals = true,
	workingHours: initialHours = STORY_WORKING_HOURS,
	holidayRegion: initialRegion = null,
	dayExceptions: initialExceptions = {},
	initialSheet,
	splitDays,
	shell = true
}: {
	role?: CalendarRole;
	scope?: CalendarVisibilityScope;
	showUsernames?: boolean;
	state?: CalendarLoadState;
	empty?: boolean;
	compact?: boolean;
	initialView?: CalendarViewName;
	shownColleagues?: string[];
	fullscreen?: boolean;
	switcherStyle?: ViewSwitcherStyle;
	proposals?: MoveProposal[];
	withProposals?: boolean;
	workingHours?: WorkingHours;
	holidayRegion?: HolidayRegion | null;
	dayExceptions?: DayExceptions;
	initialSheet?: SheetStop;
	splitDays?: SplitDays;
	shell?: boolean;
}) => {
	const visibility = { scope, showUsernames };
	const colleagues =
		role === 'consultant' ? colleaguesInScope(COLLEAGUES, scope) : [];
	const [own, setOwn] = useState<CalendarEntry[]>(
		empty ? [] : role === 'asker' ? ASKER_ENTRIES : OWN_ENTRIES
	);
	const [hours, setHours] = useState<WorkingHours>(initialHours);
	const [region, setRegion] = useState<HolidayRegion | null>(initialRegion);
	const [exceptions, setExceptions] =
		useState<DayExceptions>(initialExceptions);
	const [proposals, setProposals] =
		useState<MoveProposal[]>(initialProposals);
	const [feedToken, setFeedToken] = useState(0);
	const [busyImport, setBusyImport] = useState<{
		host?: string;
		lastSyncedAt?: string;
	}>({});
	const ownerId = role === 'asker' ? 'asker' : ME;
	const colleagueEntries = COLLEAGUE_ENTRIES.filter((e) =>
		colleagues.some((c) => c.id === e.ownerId)
	).map((e) => redactForColleague(e, visibility));

	const create = (drafts: AppointmentDraft[]) => {
		const created: CalendarEntry[] = drafts.map((d, i) => ({
			id: `new-${Date.now()}-${i}`,
			type: d.type,
			kind: d.kind,
			ownerId,
			sessionId: d.sessionId,
			allDay: d.allDay,
			title:
				d.type === 'appointment'
					? CONVERSATIONS.find((c) => c.sessionId === d.sessionId)
							?.username
					: d.note,
			start: d.start.toISOString(),
			end: d.end.toISOString()
		}));
		setOwn((all) => [...all, ...created]);
		// Like UserService: the answer carries the stored entries, so the
		// notice can undo a blocker entered at once.
		return Promise.resolve(created);
	};

	const page = (
		<CalendarPage
			role={role}
			ownerId={ownerId}
			state={state}
			entries={[...own, ...colleagueEntries]}
			colleagues={colleagues}
			visibility={visibility}
			conversations={CONVERSATIONS}
			workingHours={hours}
			holidayRegion={region}
			dayExceptions={exceptions}
			feed={{
				url: feedToken
					? FEED_URL.replace('9f3c', `r${feedToken}e`)
					: FEED_URL,
				lastFetchedAt: feedToken
					? undefined
					: new Date(2026, 10, 16, 7, 12).toISOString()
			}}
			busyImport={busyImport}
			compact={compact}
			initialSheet={initialSheet}
			initialView={initialView}
			initialShownColleagues={shownColleagues}
			initialFullscreen={fullscreen}
			initialSwitcherStyle={switcherStyle}
			initialSplitDays={splitDays}
			now={STORY_NOW}
			onCreate={role === 'consultant' ? create : undefined}
			onMove={(entry, start, end) =>
				setOwn((all) =>
					all.map((e) =>
						e.id === entry.id
							? {
									...e,
									start: start.toISOString(),
									end: end.toISOString()
								}
							: e
					)
				)
			}
			onCancelAppointment={(entry) =>
				setOwn((all) => all.filter((e) => e.id !== entry.id))
			}
			onRemoveBlocker={(entry) =>
				setOwn((all) => all.filter((e) => e.id !== entry.id))
			}
			onSaveWorkingHours={(next, nextRegion) => {
				setHours(next);
				setRegion(nextRegion);
			}}
			onSaveDayException={(date, windows) =>
				setExceptions((all) => ({ ...all, [date]: windows }))
			}
			onDeleteDayException={(date) =>
				setExceptions((all) => {
					const rest = { ...all };
					delete rest[date];
					return rest;
				})
			}
			proposals={proposals}
			onProposeMove={
				withProposals
					? (entry, start, end) =>
							setProposals((all) =>
								addProposal(all, {
									id: `p-${Date.now()}`,
									entryId: entry.id,
									start: start.toISOString(),
									end: end.toISOString()
								})
							)
					: undefined
			}
			onWithdrawProposal={
				withProposals
					? (proposal) =>
							setProposals((all) =>
								withdrawProposal(all, proposal.id)
							)
					: undefined
			}
			onJoin={withProposals ? fn() : undefined}
			onStart={fn()}
			onOpenChat={fn()}
			onResetFeed={() => setFeedToken((n) => n + 1)}
			onSaveImport={(url) =>
				setBusyImport({
					host: new URL(url.replace(/^webcal:/i, 'https:')).host,
					lastSyncedAt: STORY_NOW.toISOString()
				})
			}
			onRemoveImport={() => setBusyImport({})}
		/>
	);

	if (!shell) return page;
	return (
		<div
			className={`calendarStory${compact ? ' calendarStory--compact' : ''}`}
		>
			<style>{`
				.calendarStory { display: flex; height: 100vh; background: var(--m3-surface-container, #f0edee); }
				.calendarStory__main { flex: 1; min-width: 0; padding: 12px 12px 12px 0; box-sizing: border-box; }
				.calendarStory--compact { flex-direction: column; }
				.calendarStory--compact .calendarStory__main { flex: 1; min-height: 0; padding: 0; overflow: auto; }
				.calendarStory--compact .app__wrapper { flex: none; height: auto; order: 2; }
			`}</style>
			<NavigationStoryShell
				role={role}
				appointmentFeatureEnabled
				onLogout={() => undefined}
			/>
			<main className="calendarStory__main">{page}</main>
		</div>
	);
};

const meta: Meta<typeof Harness> = {
	title: 'Templates/Calendar/Meine Termine',
	component: Harness,
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/booking/events' },
		docs: {
			description: {
				component:
					'FE#1050 / ADR-032, round 2 after Frank\'s prototype (2026-11-14): built like "Gespräche" — left column with search (display filter at its left, as in "Gespräche"), kind chips, open requests, "Als Nächstes" and quick entry with date, start and duration; one row of people above the calendar (shown colleagues pressed, recently shown ones to switch back on, "Weitere …"); stage with header (+, view switch, full screen, ⋮), toolbar (‹ Heute ▾ ›) and the calendar. One colour per kind; working hours shaded; colleague entries with tooltip; pending move proposals dashed. Click an entry for its actions, double-click to move it. Drag over free time → "Eintragen als". Month view: click or drag days → "Tag eintragen". "Nebeneinander": one column per person. Proposals and "Beitreten" have no backend yet and appear only here. Sample data.'
			}
		}
	},
	args: { role: 'consultant', scope: 'AGENCY', showUsernames: false }
};
export default meta;
type Story = StoryObj<typeof meta>;

const canvasOf = (el: HTMLElement) => within(el);
const body = () => within(document.body);

const entryEl = async (canvasElement: HTMLElement, id: string) => {
	let el: HTMLElement | null = null;
	await waitFor(() => {
		el = canvasElement.querySelector<HTMLElement>(
			`[data-entry-id="${id}"]`
		);
		expect(el).toBeTruthy();
	});
	return el as unknown as HTMLElement;
};

/** Menus and their forms carry `data-cy` (Cypress), not `data-testid`. */
const findCy = (cy: string) =>
	waitFor(() => {
		const el = document.body.querySelector<HTMLElement>(
			`[data-cy="${cy}"]`
		);
		expect(el).toBeTruthy();
		return el!;
	});

/** The element `findCy` waited for, as a plain lookup. */
const cyEl = (cy: string) =>
	document.body.querySelector<HTMLElement>(`[data-cy="${cy}"]`)!;

export const WorkWeek: Story = {
	name: 'Counsellor — work week (default)',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByTestId('calendar-view')).toBeTruthy();
		await expect(
			(await canvas.findAllByText('ruhiges_yak')).length
		).toBeGreaterThan(0);
		// The appointment starting in ten minutes is the only red one.
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calEntry--soon').length
			).toBe(1)
		);
		// Outside 08:00–18:00 is shaded; the all-day row says "ganztägig".
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calendarView__offHours').length
			).toBeGreaterThan(0)
		);
		await expect(canvas.getByText('ganztägig')).toBeTruthy();
		// "Als Nächstes": short times, nearest at the bottom.
		const upcoming = within(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-upcoming"]'
			)!
		);
		const rows = upcoming.getAllByRole('button');
		await expect(rows[rows.length - 1].textContent).toContain('in 10 Min.');
	}
};

export const Week: Story = {
	name: 'Counsellor — week',
	args: { initialView: 'week' }
};

export const ThreeDays: Story = {
	name: 'Counsellor — three days',
	args: { initialView: 'threeDays' }
};

export const Month: Story = {
	name: 'Counsellor — month',
	args: { initialView: 'month' }
};

export const Day: Story = {
	name: 'Counsellor — day',
	args: { initialView: 'day' }
};

export const List: Story = {
	name: 'Counsellor — list',
	args: { initialView: 'list' }
};

export const ColleaguesShown: Story = {
	name: 'Colleagues shown (people bar, stripes, tooltip)',
	args: { shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		const bar = within(
			await canvas.findByRole('group', { name: 'Personen im Kalender' })
		);
		await expect(bar.getByText('A. Kaya')).toBeTruthy();
		const entry = await entryEl(canvasElement, 'k1');
		await expect(entry.className).toContain('calEntry--colleague');
		// Hovering a colleague's entry shows who, where and what at once.
		await userEvent.hover(entry);
		const tip = await waitFor(() => {
			const peek = body()
				.getAllByRole('tooltip')
				.find((el) => el.textContent?.includes('A. Kaya'));
			expect(peek).toBeTruthy();
			return peek!;
		});
		await expect(tip.textContent).toContain('BS-N');
		await expect(tip.textContent).toContain('Beratungsstelle Nord');
		// Pointing at a person in the bar dims everybody else.
		await userEvent.hover(bar.getByText('E. Demir'));
		await waitFor(() =>
			expect(entry.className).toContain('calEntry--dimmed')
		);
	}
};

export const SplitView: Story = {
	name: 'Side by side — two colleagues',
	args: { initialView: 'split', shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		await expect(
			canvasElement.querySelectorAll('.calendarSplit__column').length
		).toBe(3);
		await expect(canvas.getAllByText('alle frei').length).toBeGreaterThan(
			0
		);
	}
};

export const SplitThreeDays: Story = {
	name: 'Side by side — three days, grouped by day',
	args: {
		initialView: 'split',
		splitDays: 3,
		shownColleagues: ['kaya', 'demir']
	},
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		const groups = canvasElement.querySelectorAll<HTMLElement>(
			'.calendarSplit__group'
		);
		// Mon–Wed, each with Ich, A. Kaya and E. Demir and its own time axis.
		await expect(groups.length).toBe(3);
		await expect(groups[0].getAttribute('aria-label')).toMatch(/16\.11\./);
		for (const group of groups) {
			await expect(
				group.querySelectorAll('.calendarSplit__column').length
			).toBe(3);
			await expect(
				group.querySelectorAll('.calendarSplit__axis').length
			).toBe(1);
		}
		// Nothing sticks with several days.
		await expect(
			canvasElement.querySelector('.calendarSplit__column--sticky')
		).toBeNull();
		await expect(canvas.getAllByText('alle frei').length).toBeGreaterThan(
			1
		);
		await expect(
			canvas.getByRole('heading', { name: '16.–18. November 2026' })
		).toBeTruthy();
	}
};

export const SplitDaysToggle: Story = {
	name: 'Side by side — three days page by one day, back to one day',
	args: SplitThreeDays.args,
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		await expect(
			canvas
				.getByRole('button', { name: '3 Tage' })
				.getAttribute('aria-pressed')
		).toBe('true');
		// Paging moves by one day, not by three.
		await userEvent.click(await findCy('calendar-next'));
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector('.calendarSplit__group')
					?.getAttribute('aria-label')
			).toMatch(/17\.11\./)
		);
		// Back to one day: "Ich" sticks on the left again.
		await userEvent.click(canvas.getByRole('button', { name: '1 Tag' }));
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.calendarSplit__column--sticky')
			).toBeTruthy()
		);
		await expect(
			canvasElement.querySelectorAll('.calendarSplit__group').length
		).toBe(0);
	}
};

export const SplitOverflow: Story = {
	name: 'Side by side — six colleagues, scrolling',
	args: {
		scope: 'TENANT',
		initialView: 'split',
		shownColleagues: [
			'kaya',
			'demir',
			'hoffmann',
			'schulz',
			'brandt',
			'meier'
		]
	},
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		await expect(
			canvasElement.querySelectorAll('.calendarSplit__column').length
		).toBe(7);
		const own = canvasElement.querySelector<HTMLElement>(
			'.calendarSplit__column--own'
		)!;
		await expect(getComputedStyle(own).position).toBe('sticky');
		// More people than fit: the side arrow scrolls them.
		const next = await waitFor(() => {
			const button = canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-split-arrows-next"]'
			);
			expect(button).toBeTruthy();
			return button!;
		});
		await expect(next.getAttribute('aria-label')).toBeTruthy();
	}
};

export const Fullscreen: Story = {
	name: 'Full screen (Esc leaves)',
	args: { fullscreen: true },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		await expect(
			canvasElement.querySelector('[data-cy="calendar-side"]')
		).toBeNull();
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="calendar-side"]')
			).toBeTruthy()
		);
	}
};

export const PendingProposal: Story = {
	name: 'Move proposal — pending (dashed, "Offene Anfragen")',
	args: { shownColleagues: ['kaya'], proposals: STORY_PROPOSALS },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByText('Offene Anfragen')).toBeTruthy();
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calEntry--proposal').length
			).toBe(1)
		);
	}
};

export const WithdrawProposal: Story = {
	name: 'Move proposal — withdraw',
	args: { shownColleagues: ['kaya'], proposals: STORY_PROPOSALS },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await waitFor(() => {
				const el = canvasElement.querySelector<HTMLElement>(
					'[data-cy="calendar-request-withdraw-p1"]'
				);
				expect(el).toBeTruthy();
				return el!;
			})
		);
		await waitFor(() =>
			expect(canvas.queryByText('Offene Anfragen')).toBeNull()
		);
		await expect(
			await body().findByText('Vorschlag zurückgezogen.')
		).toBeTruthy();
	}
};

export const ProposeMove: Story = {
	name: 'Move proposal — propose for a colleague',
	args: { shownColleagues: ['kaya'] },
	play: async ({ canvasElement }) => {
		await userEvent.click(await entryEl(canvasElement, 'k1'));
		const menu = within(await findCy('calendar-menu-entry'));
		await userEvent.click(
			menu.getByRole('menuitem', { name: 'Verschiebung vorschlagen …' })
		);
		await userEvent.click(await findCy('calendar-move-submit'));
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByText('Offene Anfragen')).toBeTruthy();
	}
};

export const EntryActions: Story = {
	name: 'Entry actions — own video appointment',
	play: async ({ canvasElement }) => {
		await userEvent.click(await entryEl(canvasElement, 'a1'));
		const menu = within(await body().findByRole('menu'));
		for (const name of [
			'Video-Call starten',
			'Zum Chat',
			'Verschieben …',
			'Absagen'
		])
			await expect(menu.getByRole('menuitem', { name })).toBeTruthy();
	}
};

export const DoubleClickMoves: Story = {
	name: 'Entry actions — double click opens "Verschieben"',
	play: async ({ canvasElement }) => {
		const entry = await entryEl(canvasElement, 'a2');
		fireEvent.click(entry, { detail: 1 });
		fireEvent.click(entry, { detail: 2 });
		await expect(await findCy('calendar-move-form')).toBeTruthy();
	}
};

export const MonthDayMenu: Story = {
	name: 'Month — click a day: "Tag eintragen"',
	args: { initialView: 'month' },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		const cell = await waitFor(() => {
			const el = canvasElement.querySelector<HTMLElement>(
				'[data-date="2026-11-24"]'
			);
			expect(el).toBeTruthy();
			return el!;
		});
		const box = cell.getBoundingClientRect();
		const at = {
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height - 6
		};
		fireEvent.pointerDown(cell, { ...at, button: 0, isPrimary: true });
		fireEvent.mouseDown(cell, { ...at, button: 0 });
		fireEvent.pointerUp(cell, { ...at, button: 0, isPrimary: true });
		fireEvent.mouseUp(cell, { ...at, button: 0 });
		const menu = within(await findCy('calendar-menu-month'));
		await expect(
			menu.getByRole('menuitem', { name: /Ganztägig/ })
		).toBeTruthy();
		await expect(
			menu.getByRole('menuitem', { name: /Termin eintragen/ })
		).toBeTruthy();
	}
};

export const SettingsMenu: Story = {
	name: 'Settings — ⋮ menu, view switch as buttons',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Kalender-Einstellungen'
			})
		);
		const menu = within(await body().findByRole('menu'));
		await expect(menu.getByText('Mo–Fr 08:00–18:00')).toBeTruthy();
		await userEvent.click(
			menu.getByRole('menuitemradio', { name: 'als Schalter' })
		);
		await userEvent.keyboard('{Escape}');
		await expect(
			await canvas.findByRole('radiogroup', { name: 'Ansicht' })
		).toBeTruthy();
		// The choice is stored per person: switch back so later stories open
		// with the menu again.
		await userEvent.click(
			canvas.getByRole('button', { name: 'Kalender-Einstellungen' })
		);
		await userEvent.click(
			within(await body().findByRole('menu')).getByRole('menuitemradio', {
				name: 'als Menü'
			})
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				canvas.queryByRole('radiogroup', { name: 'Ansicht' })
			).toBeNull()
		);
	}
};

export const ViewDigits: Story = {
	name: 'View switch as buttons (1 3 5 7 …)',
	args: { switcherStyle: 'digits' }
};

export const QuickTyped: Story = {
	name: 'Quick entry — typing prefills the fields',
	play: async () => {
		await userEvent.type(
			await findCy('calendar-quick-input'),
			'Do 14 Uhr Video'
		);
		await expect(
			((await findCy('calendar-quick-date')) as HTMLInputElement).value
		).toBe('2026-11-19');
		await expect(
			((await findCy('calendar-quick-time')) as HTMLInputElement).value
		).toBe('14:00');
		// The fields are what is saved: a changed duration wins.
		await userEvent.click(await findCy('calendar-quick-duration-45'));
		await expect(
			(await findCy('calendar-quick-duration-45')).getAttribute(
				'aria-pressed'
			)
		).toBe('true');
	}
};

export const QuickEntry: Story = {
	name: 'Quick entry — next free half hour',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		const quick = within(
			await waitFor(() => {
				const el = canvasElement.querySelector<HTMLElement>(
					'[data-cy="calendar-quick"]'
				);
				expect(el).toBeTruthy();
				return el!;
			})
		);
		const pills = quick.getAllByRole('button', { name: /\d/ });
		await expect(pills.length).toBeGreaterThan(0);
		// Half an hour: the free pill fills date, start and 30 minutes.
		await userEvent.click(await findCy('calendar-quick-slot-30'));
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-quick-free"]'
			)!
		);
		await expect(
			((await findCy('calendar-quick-date')) as HTMLInputElement).value
		).toBe('2026-11-16');
		await expect(
			(await findCy('calendar-quick-duration-30')).getAttribute(
				'aria-pressed'
			)
		).toBe('true');
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-quick-kind-blocker"]'
			)!
		);
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-quick-save"]'
			)!
		);
		await expect(
			await body().findByText(/Sperrzeit eingetragen/)
		).toBeTruthy();
		await expect(canvas.getByTestId('calendar-view')).toBeTruthy();
	}
};

export const Phone: Story = {
	name: 'Counsellor — phone 390 px (list first)',
	globals: phone390Globals,
	args: { compact: true },
	play: async () => {
		// No left column on a phone: the people bar offers "Weitere …".
		await userEvent.click(await findCy('calendar-person-more'));
		const menu = within(await findCy('calendar-menu-people'));
		await expect(
			menu.getByRole('menuitemcheckbox', { name: /A\. Kaya/ })
		).toBeTruthy();
		await userEvent.keyboard('{Escape}');
	}
};

export const PhoneQuickEntry: Story = {
	name: 'Counsellor — phone 390 px, kind chips and quick entry',
	globals: phone390Globals,
	args: { compact: true },
	play: async ({ canvasElement }) => {
		const stage =
			canvasElement.querySelector<HTMLElement>('.calendarStage')!;
		// Row 2 under the header: the kind chips, nothing after them.
		const kinds = await waitFor(() => {
			const el = stage.querySelector<HTMLElement>(
				'.calendarStage__kinds'
			);
			expect(el).toBeTruthy();
			return el!;
		});
		await expect(
			stage.querySelector('.calendarStage__header')!.nextElementSibling
		).toBe(kinds);
		await expect(await findCy('calendar-filter-video')).toBeTruthy();
		await expect(
			kinds.querySelector('[data-cy="calendar-kinds-button"]')
		).toBeNull();
		// "Was anzeigen" sits in the search field of the sheet, as in
		// "Gespräche".
		await findCy('calendar-sheet');
		const sheet = cyEl('calendar-sheet');
		await expect(
			sheet.querySelector('[data-cy="calendar-kinds-button"]')
		).toBeTruthy();
		// Quick entry stays folded in the sheet until asked for.
		await expect(
			canvasElement.querySelector('[data-cy="calendar-quick"]')
		).toBeNull();
		await findCy('calendar-quick-toggle');
		const quickToggle = cyEl('calendar-quick-toggle');
		await expect(quickToggle.getAttribute('aria-expanded')).toBe('false');
		await userEvent.click(quickToggle);
		await expect(quickToggle.getAttribute('aria-expanded')).toBe('true');
		await expect(quickToggle.getAttribute('aria-label')).toBe(
			'Schnell eintragen schließen'
		);
		// Room for the form: the sheet opens all the way.
		await waitFor(() => expect(sheet.dataset.stop).toBe('full'));
		const input = await findCy('calendar-quick-input');
		await waitFor(() => expect(document.activeElement).toBe(input));
		await userEvent.type(input, 'Do 14 Uhr');
		await expect(
			((await findCy('calendar-quick-time')) as HTMLInputElement).value
		).toBe('14:00');
		await userEvent.click(await findCy('calendar-quick-kind-blocker'));
		// Saving folds it away again.
		await userEvent.click(await findCy('calendar-quick-save'));
		await expect(
			await body().findByText(/Sperrzeit eingetragen/)
		).toBeTruthy();
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="calendar-quick"]')
			).toBeNull()
		);
		await expect(quickToggle.getAttribute('aria-expanded')).toBe('false');
	}
};

const sheetStory = (stop: 'peek' | 'half' | 'full', label: string) => ({
	name: `Counsellor — phone 390 px, sheet ${stop}`,
	globals: phone390Globals,
	args: { compact: true, initialSheet: stop },
	play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await findCy('calendar-sheet');
		const sheet = cyEl('calendar-sheet');
		await expect(sheet.dataset.stop).toBe(stop);
		await findCy('calendar-sheet-grab');
		const grab = cyEl('calendar-sheet-grab');
		await expect(grab.getAttribute('aria-label')).toBe(label);
		const page = canvasElement.querySelector<HTMLElement>(
			'[data-testid="calendar-page"]'
		)!;
		const share = { peek: 0, half: 0.46, full: 0.88 }[stop];
		await waitFor(() =>
			expect(
				Math.abs(
					sheet.getBoundingClientRect().height -
						(stop === 'peek' ? 64 : page.clientHeight * share)
				)
			).toBeLessThan(2)
		);
	}
});

export const PhoneSheetPeek: Story = sheetStory('peek', 'Liste aufziehen');

export const PhoneSheetHalf: Story = {
	...sheetStory('half', 'Liste ganz aufziehen'),
	play: async (context) => {
		await sheetStory('half', 'Liste ganz aufziehen').play(context);
		// Enter cycles the stops, the arrows move them.
		await findCy('calendar-sheet-grab');
		const grab = cyEl('calendar-sheet-grab');
		grab.focus();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() =>
			expect(cyEl('calendar-sheet').dataset.stop).toBe('peek')
		);
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(cyEl('calendar-sheet').dataset.stop).toBe('half')
		);
	}
};

export const PhoneSheetFull: Story = sheetStory('full', 'Liste einklappen');

export const PhoneSplit: Story = {
	name: 'Counsellor — phone 390 px, side by side',
	globals: phone390Globals,
	args: {
		compact: true,
		initialView: 'split',
		shownColleagues: ['kaya', 'demir']
	},
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		const own = canvasElement.querySelector<HTMLElement>(
			'.calendarSplit__column--own'
		)!;
		// One column per person, at least 210 px wide, own one stays put.
		await expect(own.getBoundingClientRect().width).toBeGreaterThanOrEqual(
			210
		);
		await expect(getComputedStyle(own).position).toBe('sticky');
	}
};

export const English: Story = {
	name: 'Counsellor — English',
	globals: { locale: 'en' },
	args: { shownColleagues: ['kaya'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		// The people row and quick entry speak English too.
		await expect(
			await canvas.findByRole('button', { name: 'More …' })
		).toBeTruthy();
		await expect(canvas.getByText('My calendar')).toBeTruthy();
		await expect(canvas.getByText('Quick entry')).toBeTruthy();
		await expect(canvas.getByRole('button', { name: 'Add' })).toBeTruthy();
	}
};

export const CreateAppointment: Story = {
	name: 'Create with the + button (month in the dialog)',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Termin anlegen' })
		);
		const dialog = within(
			await body().findByTestId('calendar-appointment-dialog')
		);
		await userEvent.click(dialog.getByTestId('calendar-appointment-save'));
		await expect(await dialog.findByRole('alert')).toBeTruthy();
	}
};

export const FilterKinds: Story = {
	name: 'Show only some kinds',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		const video = await waitFor(() => {
			const el = canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-filter-video"]'
			);
			expect(el).toBeTruthy();
			return el!;
		});
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calendarView .calEntry').length
			).toBeGreaterThan(0)
		);
		const all = canvasElement.querySelectorAll(
			'.calendarView .calEntry'
		).length;
		await userEvent.click(video);
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calendarView .calEntry').length
			).toBeLessThan(all)
		);
		await userEvent.click(video);
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calendarView .calEntry').length
			).toBe(all)
		);
	}
};

export const TeamCounsellingCentre: Story = {
	name: 'Team — Träger allows the counselling centre',
	args: { scope: 'AGENCY' },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await waitFor(() => {
				const el = canvasElement.querySelector<HTMLElement>(
					'[data-cy="calendar-person-kaya"]'
				);
				expect(el).toBeTruthy();
				return el!;
			})
		);
		await expect(
			(await canvas.findAllByText(/A\. Kaya · /)).length
		).toBeGreaterThan(0);
		// Brandt works at another counselling centre: not offered.
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-person-more"]'
			)!
		);
		const menu = within(await body().findByRole('menu'));
		await expect(menu.queryByText('J. Brandt')).toBeNull();
		// Without the Träger's switch colleagues' entries say only "Belegt".
		await expect(canvas.queryByText(/frohe_amsel/)).toBeNull();
	}
};

export const TeamTraeger: Story = {
	name: 'Team — Träger allows the whole Träger',
	args: { scope: 'TENANT' }
};

export const TeamPlatformWithUsernames: Story = {
	name: 'Team — platform, usernames switched on',
	args: { scope: 'PLATFORM', showUsernames: true, shownColleagues: ['kaya'] }
};

export const AdviceSeeker: Story = {
	name: 'Advice seeker — read only',
	args: { role: 'asker', withProposals: false },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByTestId('calendar-view')).toBeTruthy();
		await expect(
			canvas.queryByRole('button', { name: 'Termin anlegen' })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: 'Kalender-Einstellungen' })
		).toBeNull();
	}
};

export const NoWorkingHours: Story = {
	name: 'State — no working hours set',
	args: { workingHours: [] }
};

export const Empty: Story = {
	name: 'State — no appointments',
	args: { empty: true, initialView: 'list' }
};

export const Loading: Story = {
	name: 'State — loading',
	args: { state: 'loading' }
};

export const LoadFailed: Story = {
	name: 'State — load failed',
	args: { state: 'error' }
};

// --- Working hours on the grid: grips, holidays, day exceptions ---

const forgetEdgeChoice = () => {
	try {
		window.localStorage.removeItem(`oriso.calendar.edgeChoice.${ME}`);
	} catch {
		// Storage blocked: nothing remembered either.
	}
};

const gripOf = (cy: string) => findCy(`calendar-grip-${cy}`);

export const Grips: Story = {
	name: 'Working hours — grips on the own calendar',
	beforeEach: forgetEdgeChoice,
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-view');
		// One grip at the start and one at the end of each working day.
		const start = await gripOf('2026-11-17-start');
		await expect(start.getAttribute('aria-label')).toMatch(
			/^Arbeitsbeginn am Di\., 17\.11\. verschieben, jetzt 08:00\./
		);
		await expect(await gripOf('2026-11-17-end')).toBeTruthy();
		// No grips on the free weekend.
		await expect(
			canvasElement.querySelector('[data-grip="2026-11-21-start"]')
		).toBeNull();
		// Dragging shows the new time in quarter hours.
		const end = await gripOf('2026-11-16-end');
		const box = end.getBoundingClientRect();
		const y = box.top + box.height / 2;
		fireEvent.pointerDown(end, {
			clientX: box.left + 4,
			clientY: y,
			button: 0,
			pointerId: 7,
			isPrimary: true
		});
		const column = end.closest<HTMLElement>('[role="cell"][data-date]')!;
		const hourPx = column.getBoundingClientRect().height / 14;
		fireEvent.pointerMove(end, {
			clientY: y + hourPx * 1.05,
			pointerId: 7
		});
		await findCy('calendar-grip-ghost');
		const ghost = cyEl('calendar-grip-ghost');
		await waitFor(() => expect(ghost.textContent).toBe('Ende 19:00'));
		fireEvent.pointerUp(end, {
			clientX: box.left + 4,
			clientY: y + hourPx * 1.05,
			pointerId: 7
		});
		const menu = within(await findCy('calendar-menu-edge'));
		await expect(menu.getByText('Arbeitsende 19:00')).toBeTruthy();
		await userEvent.keyboard('{Escape}');
	}
};

export const GripMenu: Story = {
	name: 'Working hours — grip moved, "Nur an diesem Tag" or "Immer"',
	beforeEach: forgetEdgeChoice,
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-view');
		const start = await gripOf('2026-11-17-start');
		start.focus();
		// The arrow keys move the grip by a quarter hour.
		await userEvent.keyboard('{ArrowUp}');
		const menu = within(await findCy('calendar-menu-edge'));
		await expect(menu.getByText('Arbeitsbeginn 07:45')).toBeTruthy();
		await expect(menu.getByText('statt 08:00 · Di., 17.11.')).toBeTruthy();
		await expect(
			menu.getByRole('menuitem', { name: /Nur an diesem Tag/ })
		).toBeTruthy();
		await expect(
			menu.getByRole('menuitem', { name: /Immer dienstags/ })
		).toBeTruthy();
		await expect(
			menu.getByRole('menuitemcheckbox', { name: /Auswahl merken/ })
		).not.toBeChecked();
	}
};

export const GripOnlyThisDay: Story = {
	name: 'Working hours — "Nur an diesem Tag" makes a day exception',
	beforeEach: forgetEdgeChoice,
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-view');
		(await gripOf('2026-11-17-start')).focus();
		await userEvent.keyboard('{ArrowDown}');
		const menu = within(await findCy('calendar-menu-edge'));
		await userEvent.click(
			menu.getByRole('menuitem', { name: /Nur an diesem Tag/ })
		);
		await expect(
			await body().findByText(
				'Arbeitsbeginn am Di., 17.11.: 08:15. Gilt nur für diesen Tag.'
			)
		).toBeTruthy();
		// The day keeps its own hours; its grips turn primary.
		await waitFor(async () =>
			expect(
				(await gripOf('2026-11-17-start')).classList.contains(
					'calendarGrip--exception'
				)
			).toBe(true)
		);
		await expect(
			(await gripOf('2026-11-18-start')).classList.contains(
				'calendarGrip--exception'
			)
		).toBe(false);
	}
};

export const GripRemembered: Story = {
	name: 'Working hours — "Immer" remembered, forgotten via ⋮',
	beforeEach: forgetEdgeChoice,
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		(await gripOf('2026-11-17-end')).focus();
		await userEvent.keyboard('{ArrowUp}');
		const menu = within(await findCy('calendar-menu-edge'));
		const remember = menu.getByRole('menuitemcheckbox', {
			name: /Auswahl merken/
		});
		await userEvent.click(remember);
		await expect(remember).toBeChecked();
		await userEvent.click(
			menu.getByRole('menuitem', { name: /Immer dienstags/ })
		);
		await expect(
			await body().findByText(
				'Arbeitsende dienstags: 17:45. Gilt ab jetzt jede Woche.'
			)
		).toBeTruthy();
		// Next time no question: the remembered choice applies at once.
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="calendar-menu-edge"]')
			).toBeNull()
		);
		(await gripOf('2026-11-18-end')).focus();
		await userEvent.keyboard('{ArrowUp}');
		await expect(
			await body().findByText(
				'Arbeitsende mittwochs: 17:45. Gilt ab jetzt jede Woche.'
			)
		).toBeTruthy();
		await expect(
			document.querySelector('[data-cy="calendar-menu-edge"]')
		).toBeNull();
		await userEvent.click(
			await canvas.findByRole('button', {
				name: 'Kalender-Einstellungen'
			})
		);
		const settings = within(await body().findByRole('menu'));
		await userEvent.click(
			settings.getByRole('menuitem', {
				name: /Gemerkte Auswahl vergessen/
			})
		);
		await expect(
			await body().findByText(
				'Beim Ziehen der Arbeitszeit wird wieder gefragt.'
			)
		).toBeTruthy();
	}
};

export const HolidayWorkWeek: Story = {
	name: 'Working hours — public holiday in the work week (Sachsen)',
	args: { holidayRegion: 'SN' },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		// Buß- und Bettag: one label in the all-day row, the day is off.
		await expect(
			await canvas.findByText('Feiertag: Buß- und Bettag')
		).toBeTruthy();
		await expect(
			canvas.getAllByText('Feiertag: Buß- und Bettag')
		).toHaveLength(1);
		await expect(
			canvasElement.querySelector('[data-grip="2026-11-18-start"]')
		).toBeNull();
		await expect(await gripOf('2026-11-19-start')).toBeTruthy();
	}
};

export const DayException: Story = {
	name: 'Working hours — one day with its own hours',
	args: {
		dayExceptions: { '2026-11-19': [{ start: '10:00', end: '15:00' }] }
	},
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-view');
		const start = await gripOf('2026-11-19-start');
		await expect(start.classList).toContain('calendarGrip--exception');
		await expect(start.getAttribute('title')).toBe(
			'Arbeitsbeginn 10:00 (nur dieser Tag) · ziehen zum Ändern'
		);
		await expect(
			(await gripOf('2026-11-19-end')).getAttribute('aria-label')
		).toContain('jetzt 15:00');
	}
};

export const SplitGrips: Story = {
	name: 'Working hours — grips in the own column side by side',
	beforeEach: forgetEdgeChoice,
	args: { initialView: 'split', shownColleagues: ['kaya'] },
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-split-view');
		const own = canvasElement.querySelector<HTMLElement>(
			'.calendarSplit__column--own'
		)!;
		await waitFor(() =>
			expect(own.querySelectorAll('.calendarGrip').length).toBe(2)
		);
		// Colleagues' columns carry none.
		await expect(
			canvasElement.querySelectorAll('.calendarGrip').length
		).toBe(2);
	}
};

// --- Single pieces ---

export const WorkingHoursPiece: StoryObj = {
	name: 'Piece — working hours dialog',
	render: () => (
		<WorkingHoursDialog
			open
			hours={STORY_WORKING_HOURS}
			holidayRegion="NW"
			now={STORY_NOW}
			onSave={() => undefined}
			onClose={() => undefined}
		/>
	),
	play: async () => {
		const dialog = within(
			await body().findByTestId('calendar-working-hours-dialog')
		);
		// Seven days, the lunch break and the public holidays.
		await expect(dialog.getAllByRole('switch')).toHaveLength(9);
		const saturday = document.querySelector<HTMLElement>(
			'[data-cy="calendar-hours-6"] input[role="switch"]'
		)!;
		await expect((saturday as HTMLInputElement).checked).toBe(false);
		// Stored as two windows a day, read back as one day and a break.
		await expect(
			document.querySelectorAll<HTMLInputElement>(
				'[data-cy="calendar-hours-1"] input[type="time"]'
			)[1].value
		).toBe('18:00');
		await expect(
			dialog.getByRole('switch', { name: 'Mittagspause' })
		).toBeChecked();
		await expect(
			dialog.getByRole('switch', { name: 'Feiertage frei' })
		).toBeChecked();
		const region = dialog.getByRole('combobox', { name: 'Bundesland' });
		await expect((region as HTMLSelectElement).value).toBe('NW');
		await expect(
			dialog.getByText(
				'Nächster Feiertag: 1. Weihnachtstag, Fr., 25.12.2026'
			)
		).toBeTruthy();
		await userEvent.selectOptions(region, 'SN');
		await expect(
			dialog.getByText(
				'Nächster Feiertag: Buß- und Bettag, Mi., 18.11.2026'
			)
		).toBeTruthy();
	}
};

export const RepeatingBlocker: StoryObj = {
	name: 'Piece — Sperrzeit every Monday',
	render: () => (
		<BlockerDialog
			open
			slot={{
				start: new Date(2026, 10, 16, 13, 0),
				end: new Date(2026, 10, 16, 17, 0)
			}}
			entries={OWN_ENTRIES}
			ownerId={ME}
			now={STORY_NOW}
			onSave={() => undefined}
			onClose={() => undefined}
		/>
	),
	play: async () => {
		const dialog = within(
			await body().findByTestId('calendar-blocker-dialog')
		);
		await expect(dialog.getByRole('status').textContent).toContain(
			'1 Sperrzeit'
		);
		await userEvent.click(
			document.querySelector<HTMLElement>(
				'[data-cy="calendar-weekday-1"]'
			)!
		);
		await waitFor(() =>
			expect(dialog.getByRole('status').textContent).toMatch(
				/[2-9] Sperrzeiten/
			)
		);
	}
};
