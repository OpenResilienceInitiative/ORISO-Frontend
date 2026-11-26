import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { SupervisorAppointmentDialog } from './SupervisorAppointmentDialog';
import {
	COLLEAGUES,
	ME,
	OWN_ENTRIES,
	STORY_NOW
} from '../calendar/calendarStoryData';
import '../calendar/calendar.styles.scss';

/**
 * FE#2494 — "Termin mit Supervisor:in vereinbaren" from the ⋮ menu of the
 * Supervision room. It is the calendar's appointment with a colleague
 * (FE#2305) with the supervisor already chosen: same form, same conflict
 * note, same save path. The appointment shows in both calendars; the notice
 * goes into the private internal chat of the two.
 */
const SUPERVISOR = COLLEAGUES[0];

const meta: Meta<typeof SupervisorAppointmentDialog> = {
	title: 'P0 v2.0.18/Termin aus dem Chatraum/Supervision',
	component: SupervisorAppointmentDialog,
	globals: { locale: 'de' },
	parameters: { layout: 'fullscreen' },
	args: {
		supervisor: {
			id: SUPERVISOR.id,
			displayName: SUPERVISOR.displayName
		},
		colleagues: COLLEAGUES,
		entries: OWN_ENTRIES,
		ownerId: ME,
		now: STORY_NOW,
		onSave: fn(),
		onClose: fn()
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** The supervisor is fixed: no choice of colleague, only day, time and Art. */
export const Default: Story = {
	name: 'Supervisor:in fest, Tag · Zeit · Art',
	play: async ({ args }) => {
		const fixed = await body().findByText(SUPERVISOR.displayName);
		// The dialog fades in: wait for it rather than read it mid-transition.
		await waitFor(() => expect(fixed).toBeVisible());
		await expect(
			body().queryByRole('combobox', { name: 'Kolleg:in' })
		).toBeNull();
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await waitFor(() =>
			expect(args.onSave).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'appointment',
					colleagueId: SUPERVISOR.id
				})
			)
		);
	}
};

/** The supervisor's Träger allows no internal chat: only "Vor Ort". */
export const OnsiteOnly: Story = {
	name: 'Kein interner Chat erlaubt: nur Vor Ort',
	args: {
		colleagues: [{ ...SUPERVISOR, internalChat: false }]
	},
	play: async () => {
		const onsite = await body().findByRole('button', { name: 'Vor Ort' });
		await waitFor(() => expect(onsite).toBeVisible());
		await expect(
			body().queryByRole('button', { name: 'Video' })
		).toBeNull();
	}
};

/**
 * Product owner, 2026-11-25: video and phone appointments only where the
 * supervision chat allows video and audio calls. Video off: no "Video"
 * tile, "Telefon" is the default.
 */
export const VideoCallsOff: Story = {
	name: 'Supervision ohne Videoanruf: kein Video-Termin',
	args: { callGates: { video: false, audio: true } },
	play: async ({ args }) => {
		const phone = await body().findByRole('button', { name: 'Telefon' });
		await waitFor(() => expect(phone).toBeVisible());
		await expect(phone).toHaveAttribute('aria-pressed', 'true');
		await expect(
			body().queryByRole('button', { name: 'Video' })
		).toBeNull();
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await waitFor(() =>
			expect(args.onSave).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'phone' })
			)
		);
	}
};

/** Audio off: no "Telefon" tile, "Video" stays the default. */
export const AudioCallsOff: Story = {
	name: 'Supervision ohne Audioanruf: kein Telefon-Termin',
	args: { callGates: { video: true, audio: false } },
	play: async () => {
		const video = await body().findByRole('button', { name: 'Video' });
		await waitFor(() => expect(video).toBeVisible());
		await expect(video).toHaveAttribute('aria-pressed', 'true');
		await expect(
			body().queryByRole('button', { name: 'Telefon' })
		).toBeNull();
	}
};

/** Neither: no video or phone appointment, "Vor Ort" is the default. */
export const NoCallsAllowed: Story = {
	name: 'Supervision ohne Anrufe: nur Vor Ort und Chat',
	args: { callGates: { video: false, audio: false } },
	play: async ({ args }) => {
		const onsite = await body().findByRole('button', { name: 'Vor Ort' });
		await waitFor(() => expect(onsite).toBeVisible());
		await expect(onsite).toHaveAttribute('aria-pressed', 'true');
		await expect(
			body().getByRole('button', { name: 'Chat' })
		).toBeVisible();
		await expect(
			body().queryByRole('button', { name: 'Video' })
		).toBeNull();
		await expect(
			body().queryByRole('button', { name: 'Telefon' })
		).toBeNull();
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await waitFor(() =>
			expect(args.onSave).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'onsite' })
			)
		);
	}
};

/** Outside the own calendar reach: said plainly, no save that must fail. */
export const Unreachable: Story = {
	name: 'Supervisor:in nicht im Kalender erreichbar',
	args: { colleagues: COLLEAGUES.slice(1) },
	play: async () => {
		const note = await body().findByTestId(
			'supervision-appointment-unreachable'
		);
		await waitFor(() => expect(note).toBeVisible());
		await expect(
			body().queryByTestId('calendar-appointment-save')
		).toBeNull();
	}
};

/** Saving failed: the form stays, the message says to try again. */
export const SaveFailed: Story = {
	name: 'Speichern fehlgeschlagen',
	args: {
		error: 'Der Termin konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
	}
};

/** Phone: the dialog fills the screen, as every calendar dialog. */
export const Phone: Story = {
	name: 'Telefon: Vollbild',
	args: { fullScreen: true },
	globals: { viewport: { value: 'mobile1', isRotated: false } }
};
