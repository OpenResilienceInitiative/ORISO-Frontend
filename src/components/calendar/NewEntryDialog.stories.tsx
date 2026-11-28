import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { NewEntryDialog } from './NewEntryDialog';
import type { CalendarEntry } from './calendarModel';
import './calendar.styles';

/**
 * ORISO-Frontend#2303 / #2500: "Neuer Eintrag" with the third tab
 * "Abwesenheit". An absence is either dated (first to last day) or without
 * dates: then it runs Monday to Monday and extends itself every Monday until
 * the counsellor ends it. Appointments inside it are cancelled and the
 * counsellor is taken off Gesprächskreise (#2500); the form says so before
 * saving and counts what is affected.
 *
 * NOW is Monday 14 Dec 2026. The dated range is preset to 21–27 Dec; the
 * absence without dates covers 14 Dec up to Monday 21 Dec.
 */
const NOW = new Date(2026, 11, 14, 9, 0);
const at = (day: number, hour: number) =>
	new Date(2026, 11, day, hour).toISOString();
const entry = (
	id: string,
	type: CalendarEntry['type'],
	title: string,
	day: number,
	hour: number
): CalendarEntry => ({
	id,
	type,
	kind: type === 'appointment' ? 'video' : undefined,
	ownerId: 'me',
	title,
	start: at(day, hour),
	end: at(day, hour + 1)
});
/** Inside the dated range 21–27 Dec. */
const NEXT_WEEK: CalendarEntry[] = [
	entry('a1', 'appointment', 'mutige_eule', 22, 10),
	entry('a2', 'appointment', 'stille_amsel', 23, 14),
	entry('g1', 'group', 'Gesprächskreis Trauer', 24, 18)
];
/** Inside this week (14–20 Dec), the first week of an absence without dates. */
const THIS_WEEK: CalendarEntry[] = [
	entry('a3', 'appointment', 'mutige_eule', 16, 10),
	entry('g2', 'group', 'Gesprächskreis Trauer', 17, 18)
];

const meta: Meta<typeof NewEntryDialog> = {
	title: 'Components/Calendar/Neuer Eintrag',
	component: NewEntryDialog,
	globals: { locale: 'de', ...desktop1440Globals },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'"Neuer Eintrag" with the tabs Termin | Sperrzeit | Abwesenheit. "Abwesenheit" (ORISO-Frontend#2303, #2500) sets the absence of the profile: "Mit Datum" (from–until, inclusive) or "Ohne Datum" (Monday to Monday, extends itself every Monday until ended). Before saving it says that appointments in the period are cancelled, the counsellor is taken off Gesprächskreise and advice seekers are notified, and it counts what is affected. The cancelling is done by UserService.'
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

/** The dialog renders in a portal, outside the story canvas. */
const body = () => within(document.body);

/** Dated, nothing affected: the warning still says what saving does. */
export const Abwesenheit: Story = {
	play: async ({ args }) => {
		const warning = await body().findByTestId('calendar-absence-warning');
		await expect(warning).toHaveTextContent(
			'Alle Termine in diesem Zeitraum werden abgesagt.'
		);
		await expect(warning).toHaveTextContent('keine Termine');
		await expect(
			body().queryByTestId('calendar-absence-conflicts')
		).toBeNull();
		const save = body().getByTestId('calendar-absence-save');
		await expect(save).toHaveTextContent('Abwesenheit eintragen');
		await userEvent.click(save);
		await expect(args.onSaveAbsence).toHaveBeenCalledWith({
			kind: 'dated',
			start: '2026-12-21',
			end: '2026-12-27',
			message: 'Ich bin im Urlaub.'
		});
	}
};

/** Dated, two appointments and a Gesprächskreis inside: counted and listed. */
export const AbwesenheitMitTerminen: Story = {
	args: { entries: NEXT_WEEK },
	play: async () => {
		const affected = await body().findByTestId(
			'calendar-absence-conflicts'
		);
		await expect(affected).toHaveTextContent(
			'Betroffen: 2 Termine und 1 Gesprächskreis.'
		);
		await expect(affected).toHaveTextContent('stille_amsel');
		await expect(affected).toHaveTextContent('Gesprächskreis Trauer');
		await expect(
			body().getByTestId('calendar-absence-save')
		).toHaveTextContent('Speichern und Termine absagen');
	}
};

/** Without dates, nothing affected this week: no date fields, the weekly rule. */
export const OhneDatum: Story = {
	args: { initialAbsence: { kind: 'weekly', message: 'Ich bin im Urlaub.' } },
	play: async ({ args }) => {
		await expect(
			await body().findByRole('radio', { name: /Ohne Datum/ })
		).toBeChecked();
		await expect(body().queryByLabelText('Von')).toBeNull();
		const warning = body().getByTestId('calendar-absence-warning');
		await expect(warning).toHaveTextContent(
			'Die Abwesenheit verlängert sich jeden Montag um eine Woche'
		);
		await userEvent.click(body().getByTestId('calendar-absence-save'));
		await expect(args.onSaveAbsence).toHaveBeenCalledWith({
			kind: 'weekly',
			start: '2026-12-14',
			message: 'Ich bin im Urlaub.'
		});
	}
};

/** Without dates: this week's appointment and Gesprächskreis are affected. */
export const OhneDatumMitTerminen: Story = {
	args: {
		entries: [...THIS_WEEK, ...NEXT_WEEK],
		initialAbsence: { kind: 'weekly', message: 'Ich bin im Urlaub.' }
	},
	play: async () => {
		const affected = await body().findByTestId(
			'calendar-absence-conflicts'
		);
		await expect(affected).toHaveTextContent(
			'Betroffen: 1 Termin und 1 Gesprächskreis.'
		);
		await expect(affected).not.toHaveTextContent('stille_amsel');
	}
};

/** Switching between the two kinds shows and hides the date fields. */
export const ArtWechseln: Story = {
	play: async () => {
		await userEvent.click(
			await body().findByRole('radio', { name: /Ohne Datum/ })
		);
		await expect(body().queryByLabelText('Von')).toBeNull();
		await userEvent.click(body().getByRole('radio', { name: /Mit Datum/ }));
		await expect(body().getByLabelText('Von')).toBeInTheDocument();
	}
};

export const AbwesenheitMitTerminenPhone: Story = {
	...AbwesenheitMitTerminen,
	globals: { locale: 'de', ...phone390Globals }
};

export const OhneDatumMitTerminenPhone: Story = {
	...OhneDatumMitTerminen,
	globals: { locale: 'de', ...phone390Globals }
};

export const AbwesenheitMitTerminenEnglish: Story = {
	args: { entries: NEXT_WEEK },
	globals: { locale: 'en', ...desktop1440Globals },
	play: async () => {
		const affected = await body().findByTestId(
			'calendar-absence-conflicts'
		);
		await expect(affected).toHaveTextContent(
			'Affected: 2 appointments and 1 conversation circle.'
		);
	}
};

export const OhneDatumMitTerminenEnglish: Story = {
	args: OhneDatumMitTerminen.args,
	globals: { locale: 'en', ...desktop1440Globals },
	play: async () => {
		const warning = await body().findByTestId('calendar-absence-warning');
		await expect(warning).toHaveTextContent(
			'The absence extends every Monday by one week until you end it.'
		);
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
