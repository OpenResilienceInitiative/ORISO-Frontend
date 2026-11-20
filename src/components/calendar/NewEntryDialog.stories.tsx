import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { NewEntryDialog } from './NewEntryDialog';
import type { CalendarEntry } from './calendarModel';
import './calendar.styles';

/**
 * ORISO-Frontend#2303: "Neuer Eintrag" with the third tab "Abwesenheit".
 * A planned absence over whole days; it is the same absence as in the
 * profile. Appointments inside the range are listed, never cancelled
 * (Frank, 2026-11-17).
 */
const NOW = new Date(2026, 11, 14, 9, 0);
const INSIDE: CalendarEntry = {
	id: 'a1',
	type: 'appointment',
	kind: 'video',
	ownerId: 'me',
	title: 'mutige_eule',
	start: new Date(2026, 11, 22, 10).toISOString(),
	end: new Date(2026, 11, 22, 11).toISOString()
};

const meta: Meta<typeof NewEntryDialog> = {
	title: 'Components/Calendar/Neuer Eintrag',
	component: NewEntryDialog,
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'"Neuer Eintrag" with the tabs Termin | Sperrzeit | Abwesenheit. "Abwesenheit" (ORISO-Frontend#2303) sets the planned absence of the profile: from–until, inclusive, with the message advice seekers see. After the last day the counsellor is present again automatically. Appointments inside the range are listed as a warning and stay in place.'
			}
		}
	},
	args: {
		open: true,
		initialTab: 'absence',
		conversations: [{ sessionId: 7, username: 'mutige_eule' }],
		entries: [],
		ownerId: 'me',
		now: NOW,
		slot: {
			start: new Date(2026, 11, 21),
			end: new Date(2026, 11, 22)
		},
		initialAbsence: { message: 'Ich bin im Urlaub.' },
		onSaveAppointment: fn(),
		onSaveBlocker: fn(),
		onSaveAbsence: fn(),
		onClose: fn()
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** The absence tab with the range preset from the selected day. */
export const Abwesenheit: Story = {
	play: async ({ args }) => {
		const save = await body().findByTestId('calendar-absence-save');
		await expect(
			body().queryByTestId('calendar-absence-conflicts')
		).toBeNull();
		await userEvent.click(save);
		await expect(args.onSaveAbsence).toHaveBeenCalledWith({
			start: '2026-12-21',
			end: '2026-12-27',
			message: 'Ich bin im Urlaub.'
		});
	}
};

/** An appointment falls in the range: listed, not cancelled. */
export const AbwesenheitMitTermin: Story = {
	args: { entries: [INSIDE] },
	play: async () => {
		const warning = await body().findByTestId('calendar-absence-conflicts');
		await expect(warning).toHaveTextContent('mutige_eule');
		await expect(
			body().getByTestId('calendar-absence-save')
		).toHaveTextContent('Trotzdem anlegen');
	}
};

/** Without a way to store an absence (an asker) there is no third tab. */
export const OhneAbwesenheit: Story = {
	args: { initialTab: 'appointment', onSaveAbsence: undefined },
	play: async () => {
		await body().findByTestId('calendar-appointment-dialog');
		await expect(
			document.querySelector('[data-cy="calendar-new-tab-absence"]')
		).toBeNull();
	}
};
