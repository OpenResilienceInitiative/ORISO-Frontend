import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { InvitationDialog } from './InvitationDialog';
import { formatPresetRange } from './invitationModel';
import { NewEntryDialog } from '../calendar/NewEntryDialog';
import { DirectLinkShareDialog } from '../conversationCreate/directLink/DirectLinkShareDialog';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import '../calendar/calendar.styles';

/**
 * ORISO-Frontend#2494 *1 (P0 v2.0.18): a Direkteinladung started in the
 * calendar opens as a popup; the counsellor stays on `/booking/events`.
 * The full page "Neue Unterhaltung erstellen" stays only for "Chat
 * erstellen" in Gespräche.
 *
 * Flow, all from existing parts:
 * 1. "Neuer Eintrag" → Termin → Beratung "Neue Person per Direkteinladung …"
 *    (NewEntryDialog, unchanged).
 * 2. Popup "Direkteinladung erstellen" (InvitationDialog) with the slot from
 *    the calendar, plus Thema and Name — the two questions the "Chat
 *    erstellen" card asked before (`linkDetails`, new).
 * 3. "Link erstellen" → the share dialog with link and QR code
 *    (DirectLinkShareDialog, unchanged). "Fertig" closes it; the new link
 *    shows in "Meine Termine".
 */
const SLOT_START = new Date(2026, 10, 25, 10, 0);
const SLOT_END = new Date(2026, 10, 25, 11, 0);

const TOPICS = [
	{ value: '11', label: 'Schwangerschaftsberatung' },
	{ value: '12', label: 'Schuldnerberatung' },
	{ value: '13', label: 'Suchtberatung' }
];

const LINK: DirectLink = {
	id: 'p0-1',
	name: 'Termin Frau M.',
	topic: 'Schwangerschaftsberatung',
	topicId: 11,
	medium: 'VIDEO',
	temporary: true,
	active: true,
	url: 'https://dev.oriso.org/d/7Kq2xP',
	appointment: {
		id: 'a-1',
		start: SLOT_START.toISOString(),
		end: SLOT_END.toISOString()
	},
	validityMinutes: 24 * 60
} as DirectLink;

const meta: Meta = {
	id: 'p0-v2018-1-calendar-invitation',
	title: 'P0 v2.0.18/*1 Direkteinladung aus dem Kalender',
	globals: { locale: 'de' },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'#2494 *1: from the calendar, a Direkteinladung opens as a popup instead of the full page "Neue Unterhaltung erstellen". Step 1 is the existing "Neuer Eintrag" (Termin, Beratung "Neue Person per Direkteinladung …"); step 2 is the existing Direkteinladung dialog with the calendar slot, plus Thema and Name; step 3 is the existing share dialog. Components: `InvitationDialog` (directInvitation/InvitationDialog), `NewEntryDialog` (calendar/NewEntryDialog), `DirectLinkShareDialog` (conversationCreate/directLink/DirectLinkShareDialog).'
			}
		}
	}
};
export default meta;
type Story = StoryObj;

const body = () => within(document.body);

/** Step 1: "Neuer Eintrag" → Termin → Beratung "Neue Person per Direkteinladung …". */
export const Step1NewEntry: Story = {
	name: '1 · Neuer Eintrag → Neue Person · 1440',
	globals: desktop1440Globals,
	render: () => (
		<NewEntryDialog
			open
			initialTab="appointment"
			conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
			entries={[]}
			ownerId="me"
			now={new Date(2026, 10, 23, 9, 0)}
			slot={{ start: SLOT_START, end: SLOT_END }}
			allowGuestInvite
			onInviteNewPerson={fn()}
			onSaveAppointment={fn()}
			onSaveBlocker={fn()}
			onSaveAbsence={fn()}
			onClose={fn()}
		/>
	),
	play: async () => {
		await userEvent.click(
			await body().findByRole('combobox', { name: /Beratung/ })
		);
		await userEvent.click(
			await body().findByRole('option', {
				name: /Neue Person per Direkteinladung/
			})
		);
	}
};

const popup = (fullScreen: boolean) => (
	<InvitationDialog
		variant="invitation"
		initial={{
			start: SLOT_START,
			end: SLOT_END,
			withAppointment: true
		}}
		linkDetails={{ topics: TOPICS }}
		known={{ slot: true }}
		description={`Termin aus dem Kalender: ${formatPresetRange(
			{ start: SLOT_START, end: SLOT_END },
			'de'
		)}`}
		fullScreen={fullScreen}
		now={new Date(2026, 10, 23, 9, 0)}
		onSubmit={fn()}
		onClose={fn()}
	/>
);

/** Step 2: the popup — the calendar slot is filled in, Thema and Name on top. */
export const Step2Popup: Story = {
	name: '2 · Popup Direkteinladung · 1440',
	globals: desktop1440Globals,
	render: () => popup(false),
	play: async () => {
		await expect(
			await body().findByRole('dialog', {
				name: 'Direkteinladung erstellen'
			})
		).toBeInTheDocument();
		await expect(
			body().getByLabelText('Name (optional)')
		).toBeInTheDocument();
	}
};

/** Step 2 on a phone: the same popup fills the screen. */
export const Step2PopupPhone: Story = {
	name: '2 · Popup Direkteinladung · 390',
	globals: phone390Globals,
	render: () => popup(true)
};

/** Step 3: after "Link erstellen" — share dialog; "Fertig" returns to the calendar. */
export const Step3Share: Story = {
	name: '3 · Link teilen, zurück im Kalender · 1440',
	globals: desktop1440Globals,
	render: () => <DirectLinkShareDialog open link={LINK} onClose={fn()} />
};
