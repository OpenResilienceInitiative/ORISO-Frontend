import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ChatMenuDropdown, handleMenuKeyDown } from './ChatMenuDropdown';
import { CalendarMenu } from '../calendar/CalendarMenu';
import {
	EntryMenuContent,
	JumpMenuContent,
	KindsMenuContent,
	MonthDayMenuContent,
	PeopleMenuContent,
	ProposalMenuContent,
	SettingsMenuContent,
	SlotMenuContent,
	ViewMenuContent
} from '../calendar/calendarMenus';
import { DESKTOP_VIEWS } from '../calendar/calendarViews';
import {
	COLLEAGUE_ENTRIES,
	COLLEAGUES,
	ME,
	OWN_ENTRIES,
	STORY_NOW,
	STORY_PROPOSALS
} from '../calendar/calendarStoryData';
import { redactForColleague } from '../calendar/calendarModel';
import '../calendar/calendar.styles.scss';

/**
 * Every menu of the counsellor calendar (FE#1050, Frank 2026-11-14) is a
 * `ChatMenuDropdown` card built from the same atoms — header, items, group
 * label, note, divider. Changing the product menu changes these too. The
 * calendar opens them through `CalendarMenu` (a Popover at the pointer or
 * at the trigger); here they stand on their own.
 */
const Card = ({
	label,
	width = 280,
	role = 'menu',
	children
}: {
	label: string;
	width?: number;
	role?: 'menu' | 'dialog';
	children: React.ReactNode;
}) => (
	<ChatMenuDropdown
		density="compact"
		role={role}
		ariaLabel={label}
		onKeyDown={role === 'menu' ? handleMenuKeyDown : undefined}
		style={{ width }}
	>
		{children}
	</ChatMenuDropdown>
);

const meta: Meta = {
	title: 'Components/Chat/MenuDropdown (Calendar)',
	globals: { locale: 'de' },
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'The calendar menus as variants of `ChatMenuDropdown`: slot menu after dragging over free time, month-day menu, entry actions with the inline move / proposal form, a pending proposal, the ⋮ settings menu, the view menu, "jump to a day", the people picker and "Was anzeigen".'
			}
		}
	}
};
export default meta;
type Story = StoryObj;

const ownVideo = OWN_ENTRIES[0];
const group = OWN_ENTRIES.find((e) => e.type === 'group')!;
const colleagueEntry = redactForColleague(COLLEAGUE_ENTRIES[0], {
	scope: 'AGENCY',
	showUsernames: false
});
const kaya = COLLEAGUES[0];

export const SlotMenu: Story = {
	name: 'Slot — "Eintragen als"',
	render: () => (
		<Card label="Eintragen">
			<SlotMenuContent
				range={{
					start: new Date(2026, 10, 17, 14, 0),
					end: new Date(2026, 10, 17, 15, 0)
				}}
				onChoose={fn()}
			/>
		</Card>
	)
};

export const SlotMenuOutsideHours: Story = {
	name: 'Slot — outside the working hours',
	render: () => (
		<Card label="Eintragen">
			<SlotMenuContent
				range={{
					start: new Date(2026, 10, 17, 19, 0),
					end: new Date(2026, 10, 17, 20, 0)
				}}
				outsideHours
				onChoose={fn()}
			/>
		</Card>
	)
};

export const MonthDay: Story = {
	name: 'Month — one day',
	render: () => (
		<Card label="Tag eintragen">
			<MonthDayMenuContent
				start={new Date(2026, 10, 24)}
				days={1}
				onAllDay={fn()}
				onWithTime={fn()}
				onAppointment={fn()}
			/>
		</Card>
	)
};

export const MonthDays: Story = {
	name: 'Month — three days dragged',
	render: () => (
		<Card label="Tag eintragen">
			<MonthDayMenuContent
				start={new Date(2026, 10, 24)}
				days={3}
				onAllDay={fn()}
				onWithTime={fn()}
				onAppointment={fn()}
			/>
		</Card>
	)
};

export const EntryOwn: Story = {
	name: 'Entry — own appointment',
	render: () => (
		<Card label="Aktionen" width={300}>
			<EntryMenuContent
				entry={ownVideo}
				actions={['start', 'move', 'cancel']}
				mode="list"
				entries={OWN_ENTRIES}
				ownerId={ME}
				onMode={fn()}
				onAction={fn()}
				onMove={fn()}
			/>
		</Card>
	)
};

export const EntryMove: Story = {
	name: 'Entry — "Verschieben" inline',
	render: () => (
		<Card label="Verschieben" width={300} role="dialog">
			<EntryMenuContent
				entry={ownVideo}
				actions={['start', 'move', 'cancel']}
				mode="move"
				entries={OWN_ENTRIES}
				ownerId={ME}
				onMode={fn()}
				onAction={fn()}
				onMove={fn()}
			/>
		</Card>
	)
};

export const EntryColleague: Story = {
	name: "Entry — colleague's appointment (propose a move)",
	render: () => (
		<Card label="Aktionen" width={300}>
			<EntryMenuContent
				entry={colleagueEntry}
				colleague={kaya}
				actions={['propose']}
				mode="list"
				entries={OWN_ENTRIES}
				ownerId={ME}
				onMode={fn()}
				onAction={fn()}
				onMove={fn()}
			/>
		</Card>
	)
};

export const EntryPropose: Story = {
	name: 'Entry — proposal form',
	render: () => (
		<Card label="Verschiebung vorschlagen" width={300} role="dialog">
			<EntryMenuContent
				entry={colleagueEntry}
				colleague={kaya}
				actions={['propose']}
				mode="propose"
				entries={OWN_ENTRIES}
				ownerId={ME}
				onMode={fn()}
				onAction={fn()}
				onMove={fn()}
			/>
		</Card>
	)
};

export const EntryGroup: Story = {
	name: 'Entry — group date (join, never moved)',
	render: () => (
		<Card label="Aktionen" width={300}>
			<EntryMenuContent
				entry={group}
				actions={['join']}
				mode="list"
				entries={OWN_ENTRIES}
				ownerId={ME}
				onMode={fn()}
				onAction={fn()}
				onMove={fn()}
			/>
		</Card>
	)
};

export const Proposal: Story = {
	name: 'Pending proposal',
	render: () => (
		<Card label="Verschiebung" width={300}>
			<ProposalMenuContent
				proposal={STORY_PROPOSALS[0]}
				entry={colleagueEntry}
				approverName={kaya.displayName}
				onWithdraw={fn()}
			/>
		</Card>
	)
};

export const Settings: Story = {
	name: '⋮ Settings',
	render: () => (
		<Card label="Kalender-Einstellungen">
			<SettingsMenuContent
				workingHoursSummary="Mo–Fr 08:00–18:00"
				switcherStyle="menu"
				onWorkingHours={fn()}
				onSwitcherStyle={fn()}
				onSync={fn()}
			/>
		</Card>
	)
};

export const Views: Story = {
	name: 'View menu',
	render: () => (
		<Card label="Ansicht" width={220}>
			<ViewMenuContent
				views={DESKTOP_VIEWS}
				current="workWeek"
				onChoose={fn()}
			/>
		</Card>
	)
};

export const Jump: Story = {
	name: 'Jump to a day ("Heute" ▾)',
	render: () => (
		<Card label="Zu einem Tag springen" width={240} role="dialog">
			<JumpMenuContent now={STORY_NOW} onJump={fn()} />
		</Card>
	)
};

export const People: Story = {
	name: 'People picker ("Weitere …")',
	render: () => (
		<Card label="Kalender anzeigen">
			<PeopleMenuContent
				colleagues={COLLEAGUES.slice(0, 5)}
				shown={['kaya', 'brandt']}
				scopeHint="Sie sehen die Kalender Ihrer Beratungsstelle. Das legt Ihr Träger fest."
				onToggle={fn()}
			/>
		</Card>
	)
};

export const Kinds: Story = {
	name: '"Was anzeigen"',
	render: () => (
		<Card label="Was anzeigen">
			<KindsMenuContent
				hidden={['group']}
				onToggle={fn()}
				onShowAll={fn()}
			/>
		</Card>
	)
};

/** The real host: a Popover at the pointer, arrow keys, Escape. */
export const HostKeyboard: Story = {
	name: 'Host — keyboard (arrows, Escape)',
	render: () => {
		const Demo = () => {
			const [open, setOpen] = React.useState(true);
			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>
						open
					</button>
					<CalendarMenu
						open={open}
						anchor={{ x: 120, y: 120 }}
						label="Eintragen"
						onClose={() => setOpen(false)}
						data-cy="calendar-menu-demo"
					>
						<SlotMenuContent
							range={{
								start: new Date(2026, 10, 17, 14, 0),
								end: new Date(2026, 10, 17, 15, 0)
							}}
							onChoose={() => setOpen(false)}
						/>
					</CalendarMenu>
				</>
			);
		};
		return <Demo />;
	},
	play: async () => {
		const body = within(document.body);
		const menu = await body.findByRole('menu', { name: 'Eintragen' });
		const items = within(menu).getAllByRole('menuitem');
		await waitFor(() => expect(document.activeElement).toBe(items[0]));
		await userEvent.keyboard('{ArrowDown}');
		await expect(document.activeElement).toBe(items[1]);
		await userEvent.keyboard('{End}');
		await expect(document.activeElement).toBe(items[items.length - 1]);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(body.queryByRole('menu', { name: 'Eintragen' })).toBeNull()
		);
	}
};
