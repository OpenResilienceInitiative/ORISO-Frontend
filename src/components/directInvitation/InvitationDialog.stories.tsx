import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { InvitationDialog } from './InvitationDialog';

const tomorrowAt = (hour: number) => {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(hour, 0, 0, 0);
	return date;
};

const body = () => within(document.body);

const meta = {
	title: 'DirectInvitation/Dialog',
	component: InvitationDialog,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2252: one dialog for a Direkteinladung ("Chat erstellen", date optional) and for "Termin anlegen" in a 1:1 conversation (date required, optionally "Weitere Personen per Link einladen"). Validity after the end: − / + step in minutes below one hour and in hours above (up to 48 h, 24 h preset); a click on the field opens the list. Access: guests only / accounts only / both. Knock: on by default. Presentational; wiring is checkpoint 4.'
			}
		}
	},
	args: {
		variant: 'invitation',
		onSubmit: fn(),
		onClose: fn()
	}
} satisfies Meta<typeof InvitationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Direkteinladung without a date: every opener gets their own conversation. */
export const WithoutAppointment: Story = {
	name: 'Direkteinladung · without date · 1440',
	globals: desktop1440Globals,
	play: async () => {
		await expect(
			body().queryByRole('button', { name: /Gültig nach Terminende/ })
		).toBeNull();
		await expect(
			body().getByRole('switch', { name: 'Anklopfen' })
		).toBeChecked();
	}
};

/** With a date: one shared appointment conversation, validity stepper shown. */
export const WithAppointment: Story = {
	name: 'Direkteinladung · with date · 1440',
	globals: desktop1440Globals,
	args: {
		initial: { start: tomorrowAt(14), end: tomorrowAt(15) }
	},
	play: async () => {
		const more = body().getByRole('button', { name: 'Länger' });
		await userEvent.click(more);
		await expect(
			body().getByRole('button', { name: /Gültig nach Terminende/ })
		).toHaveTextContent('25 Stunden');
		await userEvent.click(body().getByRole('button', { name: 'Kürzer' }));
	}
};

/** The field opens all options as a list. */
export const ValidityList: Story = {
	name: 'Direkteinladung · validity list open · 1440',
	globals: desktop1440Globals,
	args: {
		initial: { start: tomorrowAt(14), end: tomorrowAt(15) }
	},
	play: async () => {
		await userEvent.click(
			body().getByRole('button', { name: /Gültig nach Terminende/ })
		);
		/* The menu grows in: visible once its transition has run. */
		await waitFor(() => expect(body().getByRole('listbox')).toBeVisible());
	}
};

export const WithAppointmentPhone: Story = {
	name: 'Direkteinladung · with date · 390',
	globals: phone390Globals,
	args: {
		fullScreen: true,
		initial: { start: tomorrowAt(14), end: tomorrowAt(15) }
	}
};

export const WithAppointmentDark: Story = {
	name: 'Direkteinladung · with date · dark · 1440',
	globals: { ...desktop1440Globals, scheme: 'dark' },
	args: {
		initial: { start: tomorrowAt(14), end: tomorrowAt(15) }
	}
};

export const WithAppointmentEnglish: Story = {
	name: 'Direkteinladung · with date · en · 390',
	globals: { ...phone390Globals, locale: 'en' },
	args: {
		fullScreen: true,
		initial: { start: tomorrowAt(14), end: tomorrowAt(15) }
	}
};

/** ⋮ "Termin anlegen" in a 1:1 as it ships today: date, start and end only. */
export const OneToOneAppointment: Story = {
	name: '1:1 Termin anlegen · today · 1440',
	globals: desktop1440Globals,
	args: { variant: 'appointment' }
};

/** ⋮ "Termin anlegen" with an interpreter invited by link. */
export const OneToOneWithGuests: Story = {
	name: '1:1 Termin anlegen · invite more people · 1440',
	globals: desktop1440Globals,
	args: {
		variant: 'appointment',
		allowGuestInvite: true,
		initial: { inviteOthers: true, access: 'guests' }
	},
	play: async () => {
		/* The dialog fades in: visible once its transition has run. */
		await waitFor(() =>
			expect(
				body().getByText(/sehen nur Nachrichten ab ihrem Beitritt/)
			).toBeVisible()
		);
	}
};

export const OneToOneWithGuestsPhoneDark: Story = {
	name: '1:1 Termin anlegen · invite more people · dark · 390',
	globals: { ...phone390Globals, scheme: 'dark' },
	args: {
		variant: 'appointment',
		allowGuestInvite: true,
		fullScreen: true,
		initial: { inviteOthers: true, access: 'guests' }
	}
};

export const OneToOneWithGuestsEnglish: Story = {
	name: '1:1 Termin anlegen · invite more people · en · 1440',
	globals: { ...desktop1440Globals, locale: 'en' },
	args: {
		variant: 'appointment',
		allowGuestInvite: true,
		initial: { inviteOthers: true }
	}
};
