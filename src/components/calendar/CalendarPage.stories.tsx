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
import type { WorkingHours } from './calendarWorkingHours';
import type { SplitDays } from './CalendarSplitView';
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
			onSaveWorkingHours={setHours}
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
					'FE#1050 / ADR-032, round 2 after Frank\'s prototype (2026-11-14): built like "Gespräche" — left column with search, kind chips and filter button, open requests, "Als Nächstes", quick entry and "Kalender daneben"; stage with header (+, view switch, full screen, ⋮), toolbar (‹ Heute ▾ ›) and the calendar. One colour per kind; working hours shaded; colleague entries with tooltip; pending move proposals dashed. Click an entry for its actions, double-click to move it. Drag over free time → "Eintragen als". Month view: click or drag days → "Tag eintragen". "Nebeneinander": one column per person. Proposals and "Beitreten" have no backend yet and appear only here. Sample data.'
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
		await expect(
			canvas.getAllByText('frei für alle').length
		).toBeGreaterThan(0);
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
		await expect(
			canvas.getAllByText('frei für alle').length
		).toBeGreaterThan(1);
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
		for (const name of ['Video-Call starten', 'Verschieben …', 'Absagen'])
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

export const QuickEntry: Story = {
	name: 'Quick entry — next free hour',
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
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-quick-free"]'
			)!
		);
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
		await expect(
			await canvas.findByText('Calendars alongside')
		).toBeTruthy();
		await expect(canvas.getByText('Quick entry')).toBeTruthy();
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
					'[data-cy="calendar-pill-kaya"]'
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
				'[data-cy="calendar-pill-more"]'
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

// --- Single pieces ---

export const WorkingHoursPiece: StoryObj = {
	name: 'Piece — working hours dialog',
	render: () => (
		<WorkingHoursDialog
			open
			hours={STORY_WORKING_HOURS}
			onSave={() => undefined}
			onClose={() => undefined}
		/>
	),
	play: async () => {
		const dialog = within(
			await body().findByTestId('calendar-working-hours-dialog')
		);
		await expect(dialog.getAllByRole('switch')).toHaveLength(7);
		const saturday = document.querySelector<HTMLElement>(
			'[data-cy="calendar-hours-6"] input[role="switch"]'
		)!;
		await expect((saturday as HTMLInputElement).checked).toBe(false);
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
