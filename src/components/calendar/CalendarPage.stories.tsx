import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NavigationStoryShell } from '../app/NavigationStoryShell';
import { phone390Globals } from '../message/messageStoryShell';
import { CalendarPage, type CalendarLoadState } from './CalendarPage';
import { SlotActionMenu } from './SlotActionMenu';
import { BlockerDialog } from './BlockerDialog';
import { EntryDetailsDialog } from './EntryDetailsDialog';
import {
	colleaguesInScope,
	redactForColleague,
	type AppointmentDraft,
	type CalendarEntry,
	type CalendarRole,
	type CalendarVisibilityScope
} from './calendarModel';
import {
	ASKER_ENTRIES,
	COLLEAGUE_ENTRIES,
	COLLEAGUES,
	CONVERSATIONS,
	FEED_URL,
	ME,
	OWN_ENTRIES,
	STORY_NOW
} from './calendarStoryData';
import type { CalendarViewName } from './CalendarView';

interface HarnessProps {
	role?: CalendarRole;
	scope?: CalendarVisibilityScope;
	showUsernames?: boolean;
	state?: CalendarLoadState;
	empty?: boolean;
	compact?: boolean;
	initialView?: CalendarViewName;
	shell?: boolean;
}

/**
 * Stand-in for the later UserService container: keeps the entries in local
 * state, so every click works, and applies the Träger's visibility the way
 * UserService will (only colleagues in scope, redacted entries).
 */
const Scenario = ({
	role = 'consultant',
	scope = 'AGENCY',
	showUsernames = false,
	state = 'ready',
	empty = false,
	compact = false,
	initialView,
	shell = true
}: HarnessProps) => {
	const visibility = { scope, showUsernames };
	const colleagues =
		role === 'consultant' ? colleaguesInScope(COLLEAGUES, scope) : [];
	const [own, setOwn] = useState<CalendarEntry[]>(
		empty ? [] : role === 'asker' ? ASKER_ENTRIES : OWN_ENTRIES
	);
	const [feedToken, setFeedToken] = useState(0);
	const [busyImport, setBusyImport] = useState<{
		url?: string;
		lastSyncedAt?: string;
		busyCount?: number;
	}>({});
	const ownerId = role === 'asker' ? 'asker' : ME;
	const colleagueEntries = COLLEAGUE_ENTRIES.filter((e) =>
		colleagues.some((c) => c.id === e.ownerId)
	).map((e) => redactForColleague(e, visibility));

	const create = (drafts: AppointmentDraft[]) =>
		setOwn((all) => [
			...all,
			...drafts.map((d, i) => ({
				id: `new-${Date.now()}-${i}`,
				type: d.type,
				kind: d.kind,
				ownerId,
				sessionId: d.sessionId,
				title:
					d.type === 'appointment'
						? CONVERSATIONS.find((c) => c.sessionId === d.sessionId)
								?.username
						: d.note,
				start: d.start.toISOString(),
				end: d.end.toISOString()
			}))
		]);

	const page = (
		<CalendarPage
			role={role}
			ownerId={ownerId}
			state={state}
			entries={[...own, ...colleagueEntries]}
			colleagues={colleagues}
			visibility={visibility}
			conversations={CONVERSATIONS}
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
			now={STORY_NOW}
			onCreate={create}
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
			onResetFeed={() => setFeedToken((n) => n + 1)}
			onSaveImport={(url) =>
				setBusyImport({
					url,
					busyCount: 14,
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
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/booking/events' },
		docs: {
			description: {
				component:
					'FE#1050 / ADR-032: the "Meine Termine" section rebuilt as a calendar on the FullCalendar MIT core, in ORISO tokens. Entries differ by icon, not colour; only the appointment about to start is red. Click or drag over free time → menu with Video, Telefon, Vor Ort, Chat and Sperrzeit. Drag an own appointment to move it (undo in the snackbar). The icon chips in the toolbar narrow the calendar to chosen kinds (none selected = all). Colleagues are switched on in the left column; who appears there is set by the Träger. Sample data; not wired to UserService yet (spec FE#2249).'
			}
		}
	},
	args: { role: 'consultant', scope: 'AGENCY', showUsernames: false }
};
export default meta;
type Story = StoryObj<typeof meta>;

const canvasOf = (el: HTMLElement) => within(el);

export const Week: Story = {
	name: 'Counsellor — week',
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
	}
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

export const Phone: Story = {
	name: 'Counsellor — phone (list first)',
	globals: phone390Globals,
	args: { compact: true }
};

export const CreateAppointment: Story = {
	name: 'Create with the + button (month in the dialog)',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Termin anlegen' })
		);
		const body = within(document.body);
		const dialog = within(
			await body.findByTestId('calendar-appointment-dialog')
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
		const video = canvasElement.querySelector<HTMLElement>(
			'[data-cy="calendar-filter-video"]'
		)!;
		const all = canvasElement.querySelectorAll('.calEntry').length;
		await userEvent.click(video);
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.calEntry').length
			).toBeLessThan(all)
		);
		await userEvent.click(video);
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('.calEntry').length).toBe(all)
		);
	}
};

export const TeamCounsellingCentre: Story = {
	name: 'Team — Träger allows the counselling centre',
	args: { scope: 'AGENCY' },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByText('A. Kaya')).toBeTruthy();
		await expect(canvas.queryByText('J. Brandt')).toBeNull();
		await userEvent.click(
			canvas.getByRole('checkbox', { name: /A\. Kaya/ })
		);
		await expect(
			(await canvas.findAllByText(/A\. Kaya · /)).length
		).toBeGreaterThan(0);
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
	args: { scope: 'PLATFORM', showUsernames: true }
};

export const Sync: Story = {
	name: 'Calendar sync (subscription link and busy import)',
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Kalender-Abgleich' })
		);
		const body = within(document.body);
		await expect(
			await body.findByTestId('calendar-sync-dialog')
		).toBeTruthy();
		await expect(body.getAllByText(/ORISO-Termin/).length).toBeGreaterThan(
			0
		);
	}
};

export const AdviceSeeker: Story = {
	name: 'Advice seeker — read only',
	args: { role: 'asker' },
	play: async ({ canvasElement }) => {
		const canvas = canvasOf(canvasElement);
		await expect(await canvas.findByTestId('calendar-view')).toBeTruthy();
		await expect(
			canvas.queryByRole('button', { name: 'Termin anlegen' })
		).toBeNull();
		await expect(
			canvas.queryByRole('button', { name: 'Kalender-Abgleich' })
		).toBeNull();
	}
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

export const SlotMenu: StoryObj = {
	name: 'Piece — menu after selecting free time',
	render: () => (
		<SlotActionMenu
			range={{
				start: new Date(2026, 10, 17, 14, 0),
				end: new Date(2026, 10, 17, 15, 0)
			}}
			anchor={{ x: 80, y: 80 }}
			onChoose={() => undefined}
			onClose={() => undefined}
		/>
	),
	play: async () => {
		const body = within(document.body);
		const menu = within(
			await body.findByRole('dialog', { name: 'Eintragen' })
		);
		for (const name of ['Video', 'Telefon', 'Vor Ort', 'Chat', 'Sperrzeit'])
			await expect(menu.getByRole('button', { name })).toBeTruthy();
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
		const body = within(document.body);
		const dialog = within(
			await body.findByTestId('calendar-blocker-dialog')
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

const detailsStory = (
	entry: CalendarEntry,
	colleagueName?: string
): StoryObj => ({
	render: () => (
		<EntryDetailsDialog
			entry={entry}
			role="consultant"
			ownerId={ME}
			colleagueName={colleagueName}
			onClose={() => undefined}
		/>
	)
});

export const DetailsVideo: StoryObj = {
	name: 'Piece — details, video',
	...detailsStory(OWN_ENTRIES[0])
};

export const DetailsOnSite: StoryObj = {
	name: 'Piece — details, on site with address',
	...detailsStory(OWN_ENTRIES[2])
};

export const DetailsColleague: StoryObj = {
	name: 'Piece — details, colleague (busy and kind only)',
	...detailsStory(
		redactForColleague(COLLEAGUE_ENTRIES[0], {
			scope: 'AGENCY',
			showUsernames: false
		}),
		'A. Kaya'
	)
};
