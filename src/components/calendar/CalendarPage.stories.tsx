import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within
} from 'storybook/test';
import { NavigationStoryShell } from '../app/NavigationStoryShell';
import {
	phone390Globals,
	tablet820Globals
} from '../message/messageStoryShell';
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
import { MyDirectLinksView } from '../directLinks/MyDirectLinksView';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import { SAMPLE_DIRECT_LINKS } from '../directLinks/directLinkSamples';
import {
	CalendarLinksBox,
	useCalendarLinksLabels
} from './CalendarLinksSection';
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
	STORY_REQUESTS,
	STORY_WORKING_HOURS
} from './calendarStoryData';
import { publishReceivedProposalCount } from './calendarProposalCount';

interface HarnessProps {
	role?: CalendarRole;
	scope?: CalendarVisibilityScope;
	showUsernames?: boolean;
	state?: CalendarLoadState;
	empty?: boolean;
	compact?: boolean;
	/** With `compact`: a phone (three days at most); false = tablet. */
	phone?: boolean;
	/** 'unset' = what a counsellor sees with nothing set (the list, *19). */
	initialView?: CalendarViewName | 'unset';
	/** Show "Links ohne Termin" with sample links in the list (*19). */
	links?: boolean;
	shownColleagues?: string[];
	fullscreen?: boolean;
	switcherStyle?: ViewSwitcherStyle;
	proposals?: MoveProposal[];
	/** Proposals colleagues sent for one's own appointments. */
	requests?: MoveProposal[];
	withProposals?: boolean;
	workingHours?: WorkingHours;
	holidayRegion?: HolidayRegion | null;
	dayExceptions?: DayExceptions;
	initialSheet?: SheetStop;
	splitDays?: SplitDays;
	shell?: boolean;
}

/**
 * Answers `GET /users/calendar/proposals` with the story's own proposals
 * while the story is shown, so the navigation count agrees with the
 * calendar. Installed during the first render: the navigation asks in its
 * own effect, before this component's effects run.
 */
const useProposalFeed = (sent: MoveProposal[], received: MoveProposal[]) => {
	const current = useRef({ sent, received });
	current.current = { sent, received };
	const restore = useRef<(() => void) | null>(null);
	const install = () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			const method = (
				init?.method ??
				(input instanceof Request ? input.method : 'GET')
			).toUpperCase();
			if (
				method === 'GET' &&
				new URL(url, window.location.href).pathname ===
					'/service/users/calendar/proposals'
			)
				return new Response(JSON.stringify(current.current), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
			restore.current = null;
		};
	};
	if (!restore.current) install();
	useEffect(() => {
		if (!restore.current) install();
		return () => restore.current?.();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
};

/**
 * Stand-in for the UserService container: keeps entries, working hours and
 * proposals in local state, so every click works, and applies the Träger's
 * visibility the way UserService does (only colleagues in scope, redacted
 * entries). Proposals sent and received are answered here as UserService
 * would; "Beitreten" has no backend yet, only Storybook passes it.
 */
const Scenario = ({
	role = 'consultant',
	scope = 'AGENCY',
	showUsernames = false,
	state = 'ready',
	empty = false,
	compact = false,
	phone,
	initialView,
	links = false,
	shownColleagues = [],
	fullscreen = false,
	switcherStyle = 'menu',
	proposals: initialProposals = [],
	requests: initialRequests = [],
	withProposals = true,
	workingHours: initialHours = STORY_WORKING_HOURS,
	holidayRegion: initialRegion = null,
	dayExceptions: initialExceptions = {},
	initialSheet,
	splitDays,
	shell = true
}: HarnessProps) => {
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
	const [requests, setRequests] = useState<MoveProposal[]>(initialRequests);
	// "Meine Termine" in the navigation counts them, as in the app: it asks
	// UserService (answered here) and hears the calendar's own number.
	useProposalFeed(proposals, requests);
	useEffect(() => {
		if (role === 'consultant')
			publishReceivedProposalCount(requests.length);
	}, [role, requests.length]);
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
			phone={phone}
			initialSheet={initialSheet}
			initialView={
				initialView === 'unset'
					? undefined
					: // Stories keep the grid they were written for; the
						// list as the default has its own story (*19).
						(initialView ??
						((phone ?? compact) ? 'threeDays' : 'workWeek'))
			}
			linksPanel={
				links ? (
					<CalendarLinksBox>
						<StoryLinksPanel />
					</CalendarLinksBox>
				) : undefined
			}
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
			receivedProposals={requests}
			onAcceptProposal={
				withProposals
					? (proposal) => {
							// Like UserService: the appointment moves, the
							// request is answered.
							setOwn((all) =>
								all.map((e) =>
									e.id === proposal.entryId
										? {
												...e,
												start: proposal.start,
												end: proposal.end
											}
										: e
								)
							);
							setRequests((all) =>
								all.filter((p) => p.id !== proposal.id)
							);
						}
					: undefined
			}
			onDeclineProposal={
				withProposals
					? (proposal) =>
							setRequests((all) =>
								all.filter((p) => p.id !== proposal.id)
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

/**
 * A changed `role` or `empty` control starts a new scenario: the local
 * entries are seeded once per scenario, edits stay inside it.
 */
const Harness = (props: HarnessProps) => (
	<Scenario
		key={`${props.role ?? 'consultant'}|${props.empty ? 'empty' : 'filled'}`}
		{...props}
	/>
);

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
					'FE#1050 / ADR-032, round 2 after Frank\'s prototype (2026-11-14): built like "Gespräche" — left column with search (display filter at its left, as in "Gespräche"), kind chips, open requests, "Als Nächstes" and quick entry with date, start and duration; one row of people above the calendar (shown colleagues pressed, recently shown ones to switch back on, "Weitere …"); stage with header (+, view switch, full screen, ⋮), toolbar (‹ Heute ▾ ›) and the calendar. One colour per kind; working hours shaded; colleague entries with tooltip; pending move proposals dashed. Click an entry for its actions, double-click to move it. Drag over free time → "Eintragen als". Month view: click or drag days → "Tag eintragen". "Nebeneinander": one column per person. Move proposals both ways: one\'s own, dashed and withdrawable; colleagues\' proposals for one\'s own appointments at the top of "Offene Verschiebungen" with "Annehmen" / "Ablehnen", counted on "Meine Termine". "Beitreten" has no backend yet and appears only here. Sample data.'
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

/** "Links ohne Termin" with sample links: copy, QR code, on/off. */
const StoryLinksPanel = () => {
	const [links, setLinks] = useState<DirectLink[]>(SAMPLE_DIRECT_LINKS);
	const [qr, setQr] = useState<DirectLink | null>(null);
	const labels = useCalendarLinksLabels();
	return (
		<>
			<MyDirectLinksView
				{...labels}
				state="ready"
				links={links}
				onToggle={(id, active) =>
					setLinks((all) =>
						all.map((link) =>
							link.id === id ? { ...link, active } : link
						)
					)
				}
				onShowQr={setQr}
				onEdit={() => undefined}
				onCreate={() => undefined}
				onRetry={() => undefined}
				onCopy={() => undefined}
			/>
			{qr && (
				<DirectLinkShareDialog
					open
					link={qr}
					onClose={() => setQr(null)}
				/>
			)}
		</>
	);
};

export const WorkWeek: Story = {
	name: 'Counsellor — work week',
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
		// One button per row: "Zum Chat" is in the entry menu (Frank *4).
		const rows = upcoming.getAllByRole('button');
		await expect(
			canvasElement.querySelector('.calendarSide__chat')
		).toBeNull();
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
	name: 'Counsellor — list (default), with "Links ohne Termin"',
	args: { initialView: 'unset', links: true },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		// Nothing set: the list is the first view (*19).
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="calendar-links"]')
			).not.toBeNull()
		);
		const links = within(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-links"]'
			)!
		);
		await expect(
			links.getByRole('heading', { name: 'Links ohne Termin' })
		).toBeTruthy();
		await expect(links.getByText('Flyer Schule')).toBeTruthy();
		await expect(canvas.getByTestId('calendar-view')).toBeTruthy();
		// "Beginnt gleich" stays readable in the list: the row does not take
		// the red soon fill the red words sit on (review 4589661574).
		const soonRow = await waitFor(() => {
			const row = canvasElement.querySelector<HTMLElement>(
				'.calEntry--listRow.calEntry--soon'
			);
			expect(row).not.toBeNull();
			return row!;
		});
		const badge = soonRow.querySelector<HTMLElement>('.calendarSoon')!;
		await expect(getComputedStyle(soonRow).backgroundColor).not.toBe(
			getComputedStyle(badge).color
		);
	}
};

export const ColleaguesShown: Story = {
	name: 'Colleagues shown (people bar, bands in the time grid)',
	args: { shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		const bar = within(
			await canvas.findByRole('group', { name: 'Personen im Kalender' })
		);
		await expect(bar.getByText('A. Kaya')).toBeTruthy();
		// Their timed entries fold into "k von n belegt" bands.
		const band = await waitFor(() => {
			const el = canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-band"]'
			);
			expect(el).toBeTruthy();
			return el!;
		});
		await expect(band.textContent).toMatch(/von 2 belegt/);
		await expect(
			canvasElement.querySelector('[data-entry-id="k1"]')
		).toBeNull();
		// Hovering a band says who is busy and who is free.
		await userEvent.hover(band);
		const tip = await waitFor(() => {
			const peek = body()
				.getAllByRole('tooltip')
				.find((el) => el.textContent?.includes('Belegt:'));
			expect(peek).toBeTruthy();
			return peek!;
		});
		await expect(tip.textContent).toContain('Frei:');
	}
};

export const ColleaguesMonth: Story = {
	name: 'Colleagues shown — month keeps single entries',
	args: { initialView: 'month', shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		const bar = within(
			await canvas.findByRole('group', { name: 'Personen im Kalender' })
		);
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

/** Names shown in a band, if the stylesheet leaves them visible. */
const visibleNamesIn = (band: HTMLElement) =>
	[...band.querySelectorAll<HTMLElement>('.calendarView__bandName')]
		.filter((name) => name.getBoundingClientRect().width > 0)
		.map((name) => name.textContent);

export const ColleaguesWhoIsBusy: Story = {
	name: 'Colleagues shown — who is in each band, where there is room (Frank *16)',
	args: {
		scope: 'TENANT',
		shownColleagues: ['kaya', 'demir', 'hoffmann', 'nowak']
	},
	play: async ({ canvasElement }) => {
		const bandOf = (label: string, name: string) =>
			[
				...canvasElement.querySelectorAll<HTMLElement>(
					'[data-cy="calendar-band"]'
				)
			].find(
				(band) =>
					band.textContent?.includes(label) &&
					band.textContent.includes(name)
			);
		// Monday 11–12: Kaya and Nowak, an hour tall: one line, the faces
		// first. At 1280 px a work-week column has no room for two names,
		// so the faces stand alone rather than as "A. K…, P. No…".
		const hour = await waitFor(() => {
			const band = bandOf('2 von 4 belegt', 'P. Nowak');
			expect(band).toBeTruthy();
			return band!;
		});
		const faces = [
			...hour.querySelectorAll<HTMLElement>('.calendarView__bandAvatar')
		].map((face) => face.getBoundingClientRect());
		await expect(faces.map((face) => face.width)).toEqual([16, 16]);
		await expect(Math.abs(faces[0].top - faces[1].top)).toBeLessThan(2);
		await expect(hour.getBoundingClientRect().width).toBeLessThan(150);
		await expect(visibleNamesIn(hour)).toEqual([]);
		// One person in an hour: face and name.
		const single = bandOf('1 von 4 belegt', 'E. Demir');
		await expect(visibleNamesIn(single!)).toEqual(['E. Demir']);
		// Thursday 09–11, two hours: one chip per person, as in the bar.
		const tall = [
			...canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy="calendar-band"]'
			)
		].find(
			(band) =>
				band.textContent?.includes('2 von 4 belegt') &&
				band.getBoundingClientRect().height >= 84
		);
		const chips = [
			...(tall?.querySelectorAll<HTMLElement>(
				'.calendarView__bandPerson'
			) ?? [])
		].map((chip) => chip.getBoundingClientRect());
		await expect(chips).toHaveLength(2);
		await expect(chips[0].height).toBeGreaterThan(16);
		await expect(chips[1].top).toBeGreaterThan(chips[0].bottom - 1);
		await expect(visibleNamesIn(tall!)).toEqual(['A. Kaya', 'P. Nowak']);
		// Half an hour is too short: the count alone.
		const short = bandOf('2 von 4 belegt', 'E. Demir');
		await expect(short).toBeTruthy();
		await expect(visibleNamesIn(short!)).toEqual([]);
		await expect(short!.textContent).toContain('2 von 4 belegt');
	}
};

/** A point on a band that no grip or entry covers. */
const pointOnBand = (band: HTMLElement) => {
	const box = band.getBoundingClientRect();
	const x = box.left + box.width * 0.7;
	for (let y = box.top + 6; y < box.bottom - 4; y += 4) {
		const top = document.elementFromPoint(x, y);
		if (
			top &&
			!top.closest('.calendarGrip, .calEntry') &&
			document.elementsFromPoint(x, y).includes(band)
		)
			return { x, y };
	}
	return null;
};
/** A click without movement, on whatever a real pointer would hit there. */
const clickAt = async ({ x, y }: { x: number; y: number }) => {
	const target = document.elementFromPoint(x, y) as HTMLElement;
	const at = { clientX: x, clientY: y, button: 0 };
	const pointer = { ...at, isPrimary: true, pointerId: 1 };
	fireEvent.pointerDown(target, { ...pointer, buttons: 1 });
	fireEvent.mouseDown(target, { ...at, buttons: 1 });
	await new Promise((resolve) => setTimeout(resolve, 50));
	fireEvent.pointerUp(target, pointer);
	fireEvent.mouseUp(target, at);
	fireEvent.click(target, { ...at, detail: 1 });
};
/** A point in a day's time-grid column with no entry and no band on it. */
const freePointIn = (root: HTMLElement, date: string) => {
	const view = root.querySelector('[data-testid="calendar-view"]')!;
	const columns = view.querySelectorAll<HTMLElement>(
		`[role="cell"][data-date="${date}"]`
	);
	// The first cell is the day's all-day cell, the last its time column.
	const allDay = columns[0].getBoundingClientRect();
	const column = columns[columns.length - 1].getBoundingClientRect();
	const x = column.left + column.width / 2;
	for (const row of view.querySelectorAll<HTMLElement>('[data-time]')) {
		const box = row.getBoundingClientRect();
		const y = box.top + box.height / 2;
		const top = document.elementFromPoint(x, y);
		const taken = document
			.elementsFromPoint(x, y)
			.some((el) => el.closest('.calEntry, [data-band], .calendarGrip'));
		if (top && view.contains(top) && !taken && y > allDay.bottom + 2)
			return { x, y };
	}
	throw new Error(`no free time on ${date}`);
};
const bandTipText = () =>
	document.querySelector('[data-cy="calendar-band-peek"]')?.textContent ?? '';
const slotMenu = () => document.querySelector('[data-cy="calendar-menu-slot"]');
/** The band card where it takes the list's place. */
const sideBandCard = () =>
	document.querySelector<HTMLElement>(
		'[data-cy="calendar-side-frame"] [data-cy="calendar-band-card"]'
	);

export const ColleaguesBandClick: Story = {
	name: 'Colleagues shown — a click on a band opens who is busy, no "Eintragen als" (Frank *16.2)',
	args: { shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		// Measured when used: the grid scrolls to 08:00 once it is laid out.
		const bandPoints = () =>
			waitFor(() => {
				const list = [
					...canvasElement.querySelectorAll<HTMLElement>(
						'[data-cy="calendar-band"]'
					)
				]
					.map(pointOnBand)
					.filter((point) => point !== null);
				expect(list.length).toBeGreaterThan(1);
				return list;
			});
		await bandPoints();
		// A click on free time still offers "Eintragen als" …
		await clickAt(freePointIn(canvasElement, '2026-11-18'));
		await findCy('calendar-menu-slot');
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(slotMenu(), 'Escape closes it').toBeNull());
		// … a click on a band says who is busy, in the left column, and
		// opens no menu, which would block the pointer for every other band.
		const [pressed, next] = await bandPoints();
		await clickAt(pressed);
		await waitFor(() =>
			expect(sideBandCard(), 'explained on click').toBeTruthy()
		);
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect(slotMenu(), 'no menu from a band').toBeNull();
		// The browser says "mouseover" on the grid's frame once the
		// selection's shadow is gone; the card stays.
		fireEvent.mouseOver(document.elementFromPoint(pressed.x, pressed.y)!, {
			clientX: pressed.x,
			clientY: pressed.y
		});
		await new Promise((resolve) => setTimeout(resolve, 100));
		await expect(sideBandCard(), 'still explained').toBeTruthy();
		// Moving on to the next band explains that one.
		fireEvent.mouseMove(document.elementFromPoint(next.x, next.y)!, {
			clientX: next.x,
			clientY: next.y
		});
		await waitFor(() =>
			expect(bandTipText(), 'explained on hover').toContain('Belegt:')
		);
		// Dragging over a band still offers "Eintragen als": colleagues
		// being busy never blocks one's own calendar.
		const [from] = await bandPoints();
		const target = document.elementFromPoint(from.x, from.y)!;
		const press = { button: 0, isPrimary: true, pointerId: 1 };
		fireEvent.pointerDown(target, {
			...press,
			buttons: 1,
			clientX: from.x,
			clientY: from.y
		});
		fireEvent.mouseDown(target, {
			button: 0,
			buttons: 1,
			clientX: from.x,
			clientY: from.y
		});
		for (const step of [10, 30, 50, 70]) {
			const at = { clientX: from.x, clientY: from.y + step, buttons: 1 };
			fireEvent.pointerMove(document, { ...press, ...at });
			fireEvent.mouseMove(document, at);
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		const end = { clientX: from.x, clientY: from.y + 70 };
		fireEvent.pointerUp(document, { ...press, ...end });
		fireEvent.mouseUp(document, { button: 0, ...end });
		await findCy('calendar-menu-slot');
	}
};

/** Monday 11–12: A. Kaya (video) and P. Nowak (phone), "2 von 4 belegt". */
const MONDAY_BAND = `${new Date(2026, 10, 16, 11).getTime()}-${new Date(2026, 10, 16, 12).getTime()}`;
const TEAM = ['kaya', 'demir', 'hoffmann', 'nowak'];
/** A band by its stretch, and a point on it no entry or grip covers. */
const bandByKey = (root: HTMLElement, key: string) =>
	waitFor(() => {
		const band = root.querySelector<HTMLElement>(`[data-band="${key}"]`);
		expect(band).toBeTruthy();
		const point = pointOnBand(band!);
		expect(point).toBeTruthy();
		return { band: band!, point: point! };
	});

export const ColleaguesBandCard: Story = {
	name: 'Colleagues shown — a click on a band: who is busy, in the left column (Frank *16.2)',
	args: { scope: 'TENANT', shownColleagues: TEAM },
	play: async ({ canvasElement }) => {
		const { band, point } = await bandByKey(canvasElement, MONDAY_BAND);
		await clickAt(point);
		const card = await waitFor(() => {
			expect(sideBandCard()).toBeTruthy();
			return sideBandCard()!;
		});
		const inCard = within(card);
		// Who is busy with what, and who is free.
		await expect(
			inCard.getByTestId('calendar-band-person-kaya').textContent
		).toContain('Video · 11:00–12:00');
		await expect(
			inCard.getByTestId('calendar-band-person-nowak').textContent
		).toContain('Telefon · 11:00–12:00');
		const free = inCard.getByTestId('calendar-band-free').textContent;
		await expect(free).toContain('E. Demir');
		await expect(free).toContain('K. Hoffmann');
		// The band is outlined; the list waits under the card, out of reach;
		// no menu holds the pointer.
		await waitFor(() => expect(band.dataset.selected).toBe('true'));
		const list = canvasElement.querySelector<HTMLElement>(
			'[data-cy="calendar-side"]'
		)!;
		await expect(getComputedStyle(list).visibility).toBe('hidden');
		await expect(
			document.querySelector('[data-cy^="calendar-menu-"]')
		).toBeNull();
		// Escape gives the list back; a click brings the card again.
		await waitFor(() =>
			expect(card.contains(document.activeElement)).toBe(true)
		);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(sideBandCard()).toBeNull());
		await expect(getComputedStyle(list).visibility).toBe('visible');
		await clickAt((await bandByKey(canvasElement, MONDAY_BAND)).point);
		await waitFor(() => expect(sideBandCard()).toBeTruthy());
		// "Kalender ansehen": side by side on that day, A. Kaya marked.
		await userEvent.click(
			within(sideBandCard()!).getByRole('button', {
				name: 'Kalender von A. Kaya ansehen'
			})
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-cy="calendar-split-column-kaya"]'
				)?.classList
			).toContain('calendarSplit__column--marked')
		);
		await expect(sideBandCard()).toBeNull();
	}
};

export const ColleaguesBandCardActions: Story = {
	name: 'Colleagues shown — from the band card: propose a new time, or enter one’s own (Frank *16.2)',
	args: { scope: 'TENANT', shownColleagues: TEAM },
	play: async ({ canvasElement }) => {
		await clickAt((await bandByKey(canvasElement, MONDAY_BAND)).point);
		const card = await waitFor(() => {
			expect(sideBandCard()).toBeTruthy();
			return sideBandCard()!;
		});
		// A colleague's appointment: a proposal they accept, through the
		// form the calendar already has.
		await userEvent.click(
			within(
				within(card).getByTestId('calendar-band-person-kaya')
			).getByRole('button', { name: /Verschiebung vorschlagen/ })
		);
		await findCy('calendar-menu-entry');
		await expect(sideBandCard(), 'the card stays').toBeTruthy();
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="calendar-menu-entry"]')
			).toBeNull()
		);
		// One's own entry at that time: "Eintragen als".
		await userEvent.click(
			within(sideBandCard()!).getByRole('button', {
				name: /Zu dieser Zeit eintragen/
			})
		);
		await findCy('calendar-menu-slot');
	}
};

export const ColleaguesBandCardFullscreen: Story = {
	name: 'Colleagues shown — full screen: the band card opens at the band (Frank *16.2)',
	args: { scope: 'TENANT', shownColleagues: TEAM, fullscreen: true },
	play: async ({ canvasElement }) => {
		await clickAt((await bandByKey(canvasElement, MONDAY_BAND)).point);
		const menu = within(await findCy('calendar-menu-band'));
		await expect(
			menu.getByTestId('calendar-band-person-kaya')
		).toBeTruthy();
		await expect(
			menu.queryByRole('button', { name: 'Zurück zur Liste' })
		).toBeNull();
		await expect(sideBandCard()).toBeNull();
	}
};

export const ColleaguesBandCardPhone: Story = {
	name: 'Colleagues shown — phone 390 px: a tap on a band opens the card over the calendar (Frank *16.2)',
	globals: phone390Globals,
	args: { scope: 'TENANT', shownColleagues: TEAM, compact: true },
	play: async ({ canvasElement }) => {
		await clickAt((await bandByKey(canvasElement, MONDAY_BAND)).point);
		const menu = within(await findCy('calendar-menu-band'));
		await expect(
			menu.getByTestId('calendar-band-person-nowak')
		).toBeTruthy();
		await expect(
			menu.getByTestId('calendar-band-free').textContent
		).toContain('E. Demir');
	}
};

/** Half-hour rows of the time grid (lanes and labels share the height). */
const slotRows = (root: HTMLElement) => [
	...root.querySelectorAll<HTMLElement>(
		'[data-testid="calendar-view"] [data-time]'
	)
];
/** Which half hour (from the first) sits at `clientY`. */
const halfHourAt = (root: HTMLElement, clientY: number) => {
	const first = slotRows(root)[0].getBoundingClientRect();
	return (clientY - first.top) / first.height;
};
/**
 * A one-hour appointment spans two half-hour rows at every zoom step: the
 * entries follow the rows, not only the background.
 */
const expectHourTall = async (entry: () => HTMLElement | null, row: number) =>
	waitFor(() => {
		const box = entry()?.getBoundingClientRect();
		expect(box).toBeTruthy();
		expect(Math.abs(box!.height - 2 * row)).toBeLessThanOrEqual(3);
	});
/** A trackpad pinch as Chrome reports it: a wheel with Ctrl. */
const pinch = (target: Element, deltaY: number, clientY: number) =>
	target.dispatchEvent(
		new WheelEvent('wheel', {
			deltaY,
			ctrlKey: true,
			clientY,
			bubbles: true,
			cancelable: true
		})
	);

export const Zoom: Story = {
	name: 'Zoom — − and + in the date bar, pinch around the pointer',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		const height = () =>
			slotRows(canvasElement)[0].getBoundingClientRect().height;
		// Starts at today's height.
		await waitFor(() => expect(height()).toBe(22));
		const zoomIn = canvas.getByRole('button', { name: 'Hineinzoomen' });
		const zoomOut = canvas.getByRole('button', { name: 'Herauszoomen' });
		// 10:00–11:00 today, own appointment.
		const hourEntry = () =>
			canvasElement.querySelector<HTMLElement>(
				'[data-testid="calendar-view"] [data-entry-id="a1"]'
			);
		await userEvent.click(zoomIn);
		await waitFor(() => expect(height()).toBe(30));
		await expectHourTall(hourEntry, height());
		await userEvent.click(zoomIn);
		await waitFor(() => expect(height()).toBe(40));
		// Pinching keeps the time under the fingers where it is.
		const view = canvas.getByTestId('calendar-view');
		const box = view.getBoundingClientRect();
		const y = box.top + box.height * 0.75;
		const before = halfHourAt(canvasElement, y);
		pinch(view, -20, y);
		await waitFor(() => expect(height()).toBeGreaterThan(40));
		await new Promise((done) => requestAnimationFrame(() => done(null)));
		await new Promise((done) => requestAnimationFrame(() => done(null)));
		await expect(
			Math.abs(halfHourAt(canvasElement, y) - before)
		).toBeLessThan(0.05);
		// Far out the labels no longer hold the rows up; − stops at 18.
		for (let i = 0; i < 8 && !(zoomOut as HTMLButtonElement).disabled; i++)
			await userEvent.click(zoomOut);
		await waitFor(() => expect(height()).toBe(18));
		await expect(zoomOut).toBeDisabled();
		await expect(zoomIn).toBeEnabled();
		await expectHourTall(hourEntry, height());
	}
};

export const ZoomSplit: Story = {
	name: 'Zoom — side by side shares the height',
	args: { initialView: 'split', shownColleagues: ['kaya', 'demir'] },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-split-view');
		const hour = () => {
			const lines = canvasElement.querySelectorAll<HTMLElement>(
				'.calendarSplit__line'
			);
			return (
				lines[1].getBoundingClientRect().top -
				lines[0].getBoundingClientRect().top
			);
		};
		await expect(hour()).toBe(44);
		const hourEntry = () =>
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-split-entry-a1"]'
			);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Hineinzoomen' })
		);
		await waitFor(() => expect(hour()).toBe(60));
		await expectHourTall(hourEntry, hour() / 2);
		// A pinch on the columns keeps the time under the pointer.
		const body = canvasElement.querySelector<HTMLElement>(
			'.calendarSplit__body'
		)!;
		const y = body.getBoundingClientRect().top + 300;
		const at = () => (y - body.getBoundingClientRect().top) / (hour() / 2);
		const before = at();
		pinch(body, 30, y);
		await waitFor(() => expect(hour()).toBeLessThan(60));
		await new Promise((done) => requestAnimationFrame(() => done(null)));
		await expect(Math.abs(at() - before)).toBeLessThan(0.05);
		// And at the smallest step.
		const zoomOut = canvas.getByRole('button', { name: 'Herauszoomen' });
		for (let i = 0; i < 8 && !(zoomOut as HTMLButtonElement).disabled; i++)
			await userEvent.click(zoomOut);
		await expect(zoomOut).toBeDisabled();
		await waitFor(() => expect(hour()).toBe(36));
		await expectHourTall(hourEntry, hour() / 2);
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
	name: 'Move proposal — pending (dashed, "Offene Verschiebungen")',
	args: { shownColleagues: ['kaya'], proposals: STORY_PROPOSALS },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(
			await canvas.findByText('Offene Verschiebungen')
		).toBeTruthy();
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
			expect(canvas.queryByText('Offene Verschiebungen')).toBeNull()
		);
		await expect(
			await body().findByText('Vorschlag zurückgezogen.')
		).toBeTruthy();
	}
};

export const ProposeMove: Story = {
	name: 'Move proposal — propose for a colleague',
	// The time grid folds colleagues into bands; side by side shows each
	// entry in its own column.
	args: { initialView: 'split', shownColleagues: ['kaya'] },
	play: async ({ canvasElement }) => {
		await userEvent.click(await entryEl(canvasElement, 'k1'));
		const menu = within(await findCy('calendar-menu-entry'));
		await userEvent.click(
			menu.getByRole('menuitem', { name: /^Verschiebung vorschlagen …/ })
		);
		await userEvent.click(await findCy('calendar-move-submit'));
		const canvas = canvasOf(canvasElement);
		await expect(
			await canvas.findByText('Offene Verschiebungen')
		).toBeTruthy();
	}
};

/** The count on "Meine Termine" in the navigation, if any. */
const navCount = (canvasElement: HTMLElement) =>
	canvasElement.querySelector(
		'a[href="/booking/events"] .navigation__item__count'
	)?.textContent ?? null;

/** A received proposal drawn in the grid at the proposed time. */
const proposalEl = async (canvasElement: HTMLElement, id: string) => {
	let el: HTMLElement | null = null;
	await waitFor(() => {
		el = canvasElement.querySelector<HTMLElement>(
			`[data-proposal-id="${id}"]`
		);
		expect(el).toBeTruthy();
	});
	return el as unknown as HTMLElement;
};

export const ReceivedRequests: Story = {
	name: 'Move proposal — received ("Annehmen" / "Ablehnen")',
	args: { requests: STORY_REQUESTS },
	play: async ({ canvasElement }) => {
		const section = within(await findCy('calendar-requests'));
		await expect(
			section.getByRole('heading', { name: 'Offene Verschiebungen' })
		).toBeTruthy();
		// Who proposes what: old and new time, also for screen readers.
		await expect(
			section.getByRole('button', {
				name: /^A\. Kaya schlägt vor, Ihren Termin .*10:00–11:00 auf .*15:00–16:00 zu verschieben$/
			})
		).toBeTruthy();
		await expect(
			section.getByRole('button', {
				name: /^Vorschlag von A\. Kaya annehmen: .*10:00–11:00 auf .*15:00–16:00$/
			})
		).toBeTruthy();
		await expect(
			section.getByRole('button', {
				name: /^Vorschlag von E\. Demir ablehnen: Der Termin bleibt .*09:00–10:00$/
			})
		).toBeTruthy();
		// Dashed in the grid and named, not told by the line alone.
		const dashed = await proposalEl(canvasElement, 'r1');
		await expect(dashed.className).toContain('calEntry--proposal');
		await expect(dashed.textContent).toContain('Vorschlag von A. Kaya');
		await expect(dashed.getAttribute('aria-label')).toMatch(
			/^Verschiebung · Vorschlag von A\. Kaya, .*15:00–16:00$/
		);
		// "Meine Termine" counts both.
		await waitFor(() => expect(navCount(canvasElement)).toBe('2'));
	}
};

export const AcceptRequest: Story = {
	name: 'Move proposal — received, accept',
	args: { requests: STORY_REQUESTS },
	play: async ({ canvasElement }) => {
		await userEvent.click(await findCy('calendar-received-accept-r1'));
		await expect(
			await body().findByText(
				/^Verschoben auf .*15:00–16:00\. Die ratsuchende Person wird benachrichtigt\.$/
			)
		).toBeTruthy();
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="calendar-received-r1"]')
			).toBeNull()
		);
		// The appointment stands at the new time, the other request waits.
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector(
						'[data-entry-id="a1"]:not([data-proposal-id])'
					)
					?.getAttribute('aria-label')
			).toMatch(/15:00–16:00$/)
		);
		await expect(
			canvasElement.querySelector('[data-cy="calendar-received-r2"]')
		).toBeTruthy();
		await waitFor(() => expect(navCount(canvasElement)).toBe('1'));
	}
};

export const DeclineRequest: Story = {
	name: 'Move proposal — received, decline from the grid',
	args: { requests: STORY_REQUESTS },
	play: async ({ canvasElement }) => {
		await userEvent.click(await proposalEl(canvasElement, 'r2'));
		const menu = within(await findCy('calendar-menu-request'));
		await expect(menu.getByText('Verschiebung vorgeschlagen')).toBeTruthy();
		await userEvent.click(
			menu.getByRole('menuitem', { name: /^Ablehnen/ })
		);
		await expect(
			await body().findByText(
				/^Vorschlag abgelehnt\. Der Termin bleibt .*09:00–10:00\.$/
			)
		).toBeTruthy();
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-proposal-id="r2"]')
			).toBeNull()
		);
		await expect(
			canvasElement.querySelector('[data-cy="calendar-received-r1"]')
		).toBeTruthy();
		await waitFor(() => expect(navCount(canvasElement)).toBe('1'));
	}
};

export const PhoneRequests: Story = {
	name: 'Move proposal — received, phone 390 px (the sheet holds it)',
	globals: phone390Globals,
	args: { compact: true, requests: STORY_REQUESTS },
	play: async () => {
		await findCy('calendar-sheet');
		const sheet = within(cyEl('calendar-sheet'));
		await expect(sheet.getByText('Offene Verschiebungen')).toBeTruthy();
		await expect(
			sheet.getByRole('button', {
				name: /^Vorschlag von A\. Kaya annehmen/
			})
		).toBeTruthy();
		await expect(
			sheet.getByRole('button', {
				name: /^Vorschlag von E\. Demir ablehnen/
			})
		).toBeTruthy();
	}
};

export const PhoneLastRequestAnswered: Story = {
	name: 'Move proposal — received, phone 390 px, the last answer closes the sheet',
	globals: phone390Globals,
	args: { compact: true, requests: STORY_REQUESTS.slice(0, 1) },
	play: async () => {
		await findCy('calendar-sheet');
		const sheet = within(cyEl('calendar-sheet'));
		await userEvent.click(
			sheet.getByRole('button', {
				name: /^Vorschlag von A\. Kaya annehmen/
			})
		);
		await expect(
			await body().findByText(/^Verschoben auf .*15:00–16:00/)
		).toBeTruthy();
		// Nothing left to answer: the sheet goes.
		await waitFor(() =>
			expect(
				document.body.querySelector('[data-cy="calendar-sheet"]')
			).toBeNull()
		);
	}
};

export const EntryActions: Story = {
	name: 'Entry actions — own video appointment',
	play: async ({ canvasElement }) => {
		await userEvent.click(await entryEl(canvasElement, 'a1'));
		const menu = within(await body().findByRole('menu'));
		// Each item is named by its title and the line under it (prototype
		// v17 menus): "Video starten mit ruhiges_yak".
		for (const name of [
			/^Video starten mit /,
			/^Zum Chat Gespräch mit /,
			/^Verschieben … Tag und Uhrzeit ändern$/,
			/^Absagen .+ bekommt eine Nachricht$/
		])
			await expect(menu.getByRole('menuitem', { name })).toBeTruthy();
	}
};

export const CancelAsksFirst: Story = {
	name: 'Entry actions — "Absagen" asks first',
	play: async ({ canvasElement }) => {
		await userEvent.click(await entryEl(canvasElement, 'a1'));
		await userEvent.click(await findCy('calendar-entry-cancel'));
		const dialog = await body().findByTestId('calendar-cancel-dialog');
		await expect(within(dialog).getByText('Termin absagen?')).toBeTruthy();
		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Nicht absagen' })
		);
		await waitFor(() =>
			expect(body().queryByTestId('calendar-cancel-dialog')).toBeNull()
		);
		await expect(await entryEl(canvasElement, 'a1')).toBeTruthy();
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
			menu.getByRole('menuitemradio', { name: /^als Schalter/ })
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
				name: /^als Menü/
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

/** The input inside a quick-entry field (Tag, Beginn). */
const quickField = async (cy: string) =>
	(await findCy(cy)).querySelector('input') as HTMLInputElement;
/** The "Dauer" select of quick entry. */
const quickDuration = async () =>
	within(await findCy('calendar-quick-duration')).getByRole('combobox');

export const QuickTyped: Story = {
	name: 'Quick entry — typing prefills the fields',
	play: async () => {
		await userEvent.type(
			await findCy('calendar-quick-input'),
			'Do 14 Uhr Video'
		);
		await expect((await quickField('calendar-quick-date')).value).toBe(
			'19.11.2026'
		);
		await expect((await quickField('calendar-quick-time')).value).toBe(
			'14:00'
		);
		// The fields are what is saved: a changed duration wins.
		await userEvent.click(await quickDuration());
		await userEvent.click(
			await body().findByRole('option', { name: '45 Min' })
		);
		await waitFor(async () =>
			expect((await quickDuration()).textContent).toBe('45 Min')
		);
	}
};

export const QuickEntry: Story = {
	name: 'Quick entry — next free half hour',
	parameters: {
		// The new half-hour entry is as tall as its duration (21 px at the
		// default zoom); it stays reachable by keyboard and in the list view.
		a11y: a11yExcept({ 'target-size': ['.calEntry'] })
	},
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
		// The kind chips lead the box, in one row (Frank *5.1).
		const kinds = canvasElement.querySelector<HTMLElement>(
			'.calendarQuick__form > .calendarQuick__kinds:first-child'
		)!;
		await expect(kinds).toBeTruthy();
		const tops = Array.from(kinds.children).map(
			(chip) => (chip as HTMLElement).offsetTop
		);
		await expect(new Set(tops).size).toBe(1);
		// Half an hour: the free pill fills date, start and 30 minutes.
		await userEvent.click(await findCy('calendar-quick-slot-30'));
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-quick-free"]'
			)!
		);
		await expect((await quickField('calendar-quick-date')).value).toBe(
			'16.11.2026'
		);
		await expect((await quickDuration()).textContent).toBe('30 Min');
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

export const PhoneTouchTargets: Story = {
	name: 'Counsellor — phone 390 px, controls at least 44 px (test finding C25)',
	globals: phone390Globals,
	args: { compact: true, initialView: 'threeDays' },
	play: async ({ canvasElement }) => {
		await findCy('calendar-previous');
		const tall = (el: Element | null) =>
			el ? Math.round(el.getBoundingClientRect().height) : 0;
		const wide = (el: Element | null) =>
			el ? Math.round(el.getBoundingClientRect().width) : 0;
		for (const id of [
			'calendar-previous',
			'calendar-next',
			'calendar-jump',
			'calendar-today'
		]) {
			const el = canvasElement.querySelector(`[data-cy="${id}"]`);
			await expect({ id, h: tall(el) >= 44, w: wide(el) >= 44 }).toEqual({
				id,
				h: true,
				w: true
			});
		}
		const search = canvasElement.querySelector(
			'.calendarStage__search .sessionsListToolbar__searchInput'
		);
		await expect(tall(search)).toBeGreaterThanOrEqual(44);
	}
};

export const Tablet: Story = {
	name: 'Counsellor — tablet 820 px (phone layout, work week)',
	globals: tablet820Globals,
	args: { compact: true, phone: false },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		// The tablet keeps the work week.
		await expect(
			(await findCy('calendar-view-menu')).textContent
		).toContain('Arbeitswoche');
		// The search at the very top, "Was anzeigen" in it.
		const stage =
			canvasElement.querySelector<HTMLElement>('.calendarStage')!;
		const search = stage.firstElementChild as HTMLElement;
		await expect(search.className).toBe('calendarStage__search');
		await expect(
			search.querySelector('[data-cy="calendar-kinds-button"]')
		).toBeTruthy();
		// No "Als Nächstes", no hours line, no sheet without open requests.
		await expect(
			canvasElement.querySelector('[data-cy="calendar-upcoming"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="calendar-working-hours"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="calendar-sheet"]')
		).toBeNull();
		// The hours live in ⋮.
		await userEvent.click(await findCy('calendar-settings'));
		await findCy('calendar-settings-working-hours');
		const item = cyEl('calendar-settings-working-hours');
		await expect(item.textContent).toContain('Arbeitszeit festlegen');
		await expect(item.textContent).toContain('08:00');
		await userEvent.keyboard('{Escape}');
	}
};

export const TabletRequests: Story = {
	name: 'Counsellor — tablet 820 px, the sheet with an open request',
	globals: tablet820Globals,
	args: {
		compact: true,
		phone: false,
		shownColleagues: ['kaya'],
		proposals: STORY_PROPOSALS
	},
	play: async () => {
		await findCy('calendar-sheet');
		const sheet = cyEl('calendar-sheet');
		await expect(
			within(sheet).getByText('Offene Verschiebungen')
		).toBeTruthy();
		await expect(
			sheet.querySelector('[data-cy="calendar-upcoming"]')
		).toBeNull();
	}
};

export const PhoneQuickEntry: Story = {
	name: 'Counsellor — phone 390 px, kind chips and quick entry',
	globals: phone390Globals,
	// The sheet is there while a request is open.
	args: {
		compact: true,
		shownColleagues: ['kaya'],
		proposals: STORY_PROPOSALS
	},
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
		// "Was anzeigen" sits in the search field, as in "Gespräche"; on the
		// phone the search is at the very top of the calendar.
		const search = stage.firstElementChild as HTMLElement;
		await expect(search.className).toBe('calendarStage__search');
		await expect(
			search.querySelector('[data-cy="calendar-kinds-button"]')
		).toBeTruthy();
		await findCy('calendar-sheet');
		const sheet = cyEl('calendar-sheet');
		await expect(
			sheet.querySelector('[data-cy="calendar-kinds-button"]')
		).toBeNull();
		// Quick entry stays folded in the sheet until asked for; folded, it
		// stays mounted (hidden), so a draft survives.
		const quickPanel = () =>
			canvasElement.querySelector<HTMLElement>('#calendar-quick-panel');
		await expect(quickPanel()?.hidden).toBe(true);
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
		await expect((await quickField('calendar-quick-time')).value).toBe(
			'14:00'
		);
		await userEvent.click(await findCy('calendar-quick-kind-blocker'));
		// Thursday 14:00 is taken: quick entry asks first, with the creation
		// dialogs' words, and only "Trotzdem anlegen" saves (review
		// 4582758042). Saving folds it away again.
		await userEvent.click(await findCy('calendar-quick-save'));
		const ask = within(
			await body().findByTestId('calendar-create-conflict')
		);
		await expect(ask.getByText(/^Überschneidet sich mit: /)).toBeTruthy();
		await expect(quickPanel()?.hidden).toBe(false);
		await userEvent.click(
			ask.getByRole('button', { name: 'Trotzdem anlegen' })
		);
		await expect(
			await body().findByText(/Sperrzeit eingetragen/)
		).toBeTruthy();
		await waitFor(() => expect(quickPanel()?.hidden).toBe(true));
		await expect(quickToggle.getAttribute('aria-expanded')).toBe('false');
	}
};

const sheetStory = (stop: 'peek' | 'half' | 'full', label: string) => ({
	name: `Counsellor — phone 390 px, sheet ${stop}`,
	globals: phone390Globals,
	args: {
		compact: true,
		initialSheet: stop,
		shownColleagues: ['kaya'],
		proposals: STORY_PROPOSALS
	},
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
		// v17 header: "New entry" as the + button; quick entry is a region
		// whose "Add" shows once the box is in use.
		await expect(
			canvas.getByRole('button', { name: 'New entry' })
		).toBeTruthy();
		const quick = within(
			canvas.getByRole('region', { name: 'Quick entry' })
		);
		await userEvent.click(
			quick.getByRole('textbox', { name: 'Quick entry' })
		);
		await expect(
			await quick.findByRole('button', { name: 'Add' })
		).toBeTruthy();
	}
};

export const CreateAppointment: Story = {
	name: 'Create with the + button (month in the dialog)',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Neuer Eintrag' })
		);
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		// An icon above the title, "Art" as four tiles (Frank *1, test C7).
		await expect(
			root.querySelector('.m3Dialog__heroIcon svg')
		).toBeTruthy();
		const phone = dialog.getByRole('button', { name: 'Telefon' });
		await userEvent.click(phone);
		await expect(phone.getAttribute('aria-pressed')).toBe('true');
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

/** Frank *14: the filter button opens "Ansicht · Kalender", as in Gespräche. */
export const ViewSettings: Story = {
	name: 'Settings — "Ansicht · Kalender" dialog',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await canvas.findByTestId('calendar-view');
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="calendar-kinds-button"]'
			)!
		);
		await body().findByText('Ansicht · Kalender');
		// "Als Knopf" off for phone: its button leaves the kind row.
		await expect(
			canvasElement.querySelector('[data-cy="calendar-filter-phone"]')
		).toBeTruthy();
		await userEvent.click(
			await body().findByRole('button', {
				name: 'Als Knopf wählen: Telefon'
			})
		);
		await userEvent.click(
			await body().findByRole('menuitemradio', { name: /^Aus/ })
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="calendar-filter-phone"]')
			).toBeNull()
		);
		// "Im Kalender" off for video: its entries leave the grid.
		const before = canvasElement.querySelectorAll(
			'.calendarView .calEntry'
		).length;
		await userEvent.click(
			await body().findByRole('checkbox', { name: 'Im Kalender: Video' })
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calendarView .calEntry').length
			).toBeLessThan(before)
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
		// One colleague shown: the time grid names her on the band.
		await expect(
			(await canvas.findAllByText('A. Kaya belegt')).length
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
			canvas.queryByRole('button', { name: 'Neuer Eintrag' })
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

const showGripsAgain = () => {
	try {
		window.localStorage.removeItem(`oriso.calendar.grips.${ME}`);
	} catch {
		// Storage blocked: nothing remembered either.
	}
};

export const GripsSwitchedOff: Story = {
	name: 'Working hours — grips switched off in ⋮',
	beforeEach: () => {
		showGripsAgain();
		return showGripsAgain;
	},
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await gripOf('2026-11-17-start');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Kalender-Einstellungen' })
		);
		const toggle = within(await body().findByRole('menu')).getByRole(
			'menuitemcheckbox',
			{ name: /Arbeitszeit und Pause ziehen/ }
		);
		await expect(toggle.getAttribute('aria-checked')).toBe('true');
		await userEvent.click(toggle);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(canvasElement.querySelector('[data-grip]')).toBeNull()
		);
	}
};

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
		// Start and end, and both ends of the pause (12:00–13:00).
		await waitFor(() =>
			expect(own.querySelectorAll('.calendarGrip').length).toBe(4)
		);
		await expect(
			own.querySelectorAll(
				'.calendarGrip--pauseStart, .calendarGrip--pauseEnd'
			).length
		).toBe(2);
		// Colleagues' columns carry none.
		await expect(
			canvasElement.querySelectorAll('.calendarGrip').length
		).toBe(4);
	}
};

export const PauseLabel: Story = {
	name: 'Working hours — "Pause" centred between its grips',
	play: async ({ canvasElement }) => {
		await canvasOf(canvasElement).findByTestId('calendar-view');
		const pill = await waitFor(() => {
			const el = canvasElement.querySelector<HTMLElement>(
				'.calendarView__breakPill'
			);
			expect(el).toBeTruthy();
			return el!;
		});
		const band = pill.closest<HTMLElement>(
			'.calendarView__offHours--break'
		)!;
		const a = pill.getBoundingClientRect();
		const b = band.getBoundingClientRect();
		// The pill's middle is the band's middle (Frank *7.3).
		await expect(
			Math.abs(a.top + a.height / 2 - (b.top + b.height / 2))
		).toBeLessThan(2);
		await expect(
			Math.abs(a.left + a.width / 2 - (b.left + b.width / 2))
		).toBeLessThan(2);
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
		// Seven days and the public holidays; each day has its own pause.
		await expect(dialog.getAllByRole('switch')).toHaveLength(8);
		const saturday = document.querySelector<HTMLElement>(
			'[data-cy="calendar-hours-6"] input[role="switch"]'
		)!;
		await expect((saturday as HTMLInputElement).checked).toBe(false);
		// Stored as two windows a day, read back as one day and its pause.
		await expect(
			document.querySelectorAll<HTMLInputElement>(
				'[data-cy="calendar-hours-1"] input[type="time"]'
			)[1].value
		).toBe('18:00');
		await expect(
			dialog.getByRole('checkbox', { name: 'Montag: Pause' })
		).toBeChecked();
		await expect(
			dialog.getByRole('checkbox', { name: 'Samstag: Pause' })
		).toBeDisabled();
		await expect(
			dialog.getByRole('switch', { name: 'Feiertage frei' })
		).toBeChecked();
		const region = dialog.getByRole('combobox', { name: 'Bundesland' });
		await expect(region).toHaveTextContent('Nordrhein-Westfalen');
		await expect(
			dialog.getByText(
				'Nächster Feiertag: 1. Weihnachtstag, Fr., 25.12.2026'
			)
		).toBeTruthy();
		await userEvent.click(region);
		await userEvent.click(
			await within(document.body).findByRole('option', {
				name: 'Sachsen'
			})
		);
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
