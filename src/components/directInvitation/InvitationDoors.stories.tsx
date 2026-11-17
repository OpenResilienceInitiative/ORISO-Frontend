import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { NewEntryDialog } from '../calendar/NewEntryDialog';
import { DirectLinkCreateCard } from '../conversationCreate/directLink/DirectLinkCreateCard';
import {
	directLinkMock,
	installDirectLinkMockApi
} from '../directLinkEntry/__storybook__/directLinkMockApi';
import { InvitationDialog } from './InvitationDialog';
import '../calendar/calendar.styles.scss';
import '../conversationCreate/conversationCreate.styles.scss';

/**
 * **One invitation flow, two entry points.** "Chat erstellen" and the
 * calendar invite in the same way (Frank, 2026-11-17): the calendar's
 * "Termin" is the same form as "Termin anlegen" in a 1:1 conversation and as
 * the Direkteinladung of "Chat erstellen". Each entry point asks only what it
 * does not know yet; the sections keep one order:
 *
 * Beratung (calendar only) → Termin → Art → Weitere Personen per Link
 * einladen → link settings.
 *
 * Someone without a conversation: the calendar's "Neue Person per
 * Direkteinladung …" opens "Chat erstellen" with the slot as appointment
 * and the Art as medium.
 */
const meta: Meta = {
	title: 'DirectInvitation/One flow — Chat erstellen and calendar',
	parameters: { layout: 'fullscreen' }
};
export default meta;
type Story = StoryObj;

const body = () => within(document.body);
const sections = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('[data-section]')).map(
		(el) => el.dataset.section
	);

const tomorrowAt = (hour: number) => {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(hour, 0, 0, 0);
	return date;
};
const SLOT = { start: tomorrowAt(14), end: tomorrowAt(15) };
const CONVERSATIONS = [
	{ sessionId: 4401, username: 'mutige_eule' },
	{ sessionId: 4402, username: 'stiller_fuchs' }
];

const onSubmit = fn();
const onSaveAppointment = fn();
const onInviteNewPerson = fn();
const onClose = fn();

/**
 * The part both entry points share once "Weitere Personen per Link
 * einladen" is on: the same controls under the same names.
 */
const expectSharedInviteSection = async (root: HTMLElement) => {
	const dialog = within(root);
	await expect(
		dialog.getByRole('group', { name: 'Art' })
	).toBeInTheDocument();
	await expect(
		dialog.getByRole('button', { name: /Gültig nach Terminende/ })
	).toBeInTheDocument();
	await expect(
		dialog.getByRole('group', { name: 'Wer darf hinein?' })
	).toBeInTheDocument();
	await expect(
		dialog.getByRole('switch', { name: 'Anklopfen' })
	).toBeChecked();
};

const CalendarTermin = ({
	slot,
	compact = false
}: {
	slot?: { start: Date; end: Date };
	compact?: boolean;
}) => (
	<NewEntryDialog
		open
		initialTab="appointment"
		slot={slot}
		conversations={CONVERSATIONS}
		entries={[]}
		ownerId="me"
		now={new Date()}
		fullScreen={compact}
		allowGuestInvite
		onInviteNewPerson={onInviteNewPerson}
		onSaveAppointment={onSaveAppointment}
		onSaveBlocker={fn()}
		onClose={onClose}
	/>
);

/** Door B: "Termin anlegen" from the ⋮ menu of a 1:1 conversation. */
export const OneToOneAppointment: Story = {
	name: '1:1 ⋮ "Termin anlegen" · Termin, Art, more people · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onSubmit.mockClear(),
	render: () => (
		<InvitationDialog
			variant="appointment"
			withKind
			allowGuestInvite
			onSubmit={onSubmit}
			onClose={onClose}
		/>
	),
	play: async () => {
		const root = await body().findByTestId('invitation-dialog');
		const dialog = within(root);
		await expect(sections(root)).toEqual(['slot', 'kind', 'invite']);
		await userEvent.click(
			dialog.getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			})
		);
		await expect(sections(root)).toEqual([
			'slot',
			'kind',
			'invite',
			'link'
		]);
		await expectSharedInviteSection(root);
		await userEvent.click(dialog.getByRole('button', { name: 'Telefon' }));
		await userEvent.click(dialog.getByRole('button', { name: 'Anlegen' }));
		await expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 'phone',
				link: { validityMinutes: 1440, access: 'both', knock: true }
			})
		);
	}
};

/** Door C from the "+" button: the same sections, with the conversation first. */
export const CalendarFromPlus: Story = {
	name: 'Calendar "+" · same sections, Beratung first · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onSaveAppointment.mockClear(),
	render: () => <CalendarTermin />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		await userEvent.click(
			dialog.getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			})
		);
		// The 1:1's sections, behind the one question the calendar must ask.
		await expect(sections(root)).toEqual([
			'conversation',
			'slot',
			'kind',
			'invite',
			'link'
		]);
		await expectSharedInviteSection(root);
	}
};

/** Door C from a selected slot: time and Art are known, so not asked again. */
export const CalendarFromSlot: Story = {
	name: 'Calendar slot · invite more people by link · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onSaveAppointment.mockClear(),
	render: () => <CalendarTermin slot={SLOT} />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		await expect(sections(root)).toEqual([
			'conversation',
			'kind',
			'invite'
		]);
		await userEvent.click(
			dialog.getByRole('combobox', { name: 'Beratung' })
		);
		await userEvent.click(
			await body().findByRole('option', { name: 'mutige_eule' })
		);
		await userEvent.click(
			dialog.getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			})
		);
		await expectSharedInviteSection(root);
		await userEvent.click(dialog.getByTestId('calendar-appointment-save'));
		await expect(onSaveAppointment).toHaveBeenCalledWith({
			type: 'appointment',
			start: SLOT.start,
			end: SLOT.end,
			kind: 'video',
			sessionId: 4401,
			link: { validityMinutes: 1440, access: 'both', knock: true }
		});
	}
};

/** Someone without a conversation: the calendar hands over to "Chat erstellen". */
export const CalendarNewPerson: Story = {
	name: 'Calendar slot · "Neue Person per Direkteinladung …" · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onInviteNewPerson.mockClear(),
	render: () => <CalendarTermin slot={SLOT} />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		await userEvent.click(
			dialog.getByRole('combobox', { name: 'Beratung' })
		);
		await userEvent.click(
			await body().findByRole('option', {
				name: 'Neue Person per Direkteinladung …'
			})
		);
		await userEvent.click(dialog.getByRole('button', { name: 'Vor Ort' }));
		// "Chat erstellen" asks who may come in; the calendar does not.
		await expect(sections(root)).toEqual(['conversation', 'kind']);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Weiter zur Direkteinladung' })
		);
		await expect(onInviteNewPerson).toHaveBeenCalledWith({
			start: SLOT.start,
			end: SLOT.end,
			kind: 'onsite'
		});
	}
};

/** The same at phone width: full screen, nothing cut off. */
export const CalendarFromSlotPhone: Story = {
	name: 'Calendar slot · invite more people by link · 390',
	globals: phone390Globals,
	render: () => <CalendarTermin slot={SLOT} compact />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		await userEvent.click(
			within(root).getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			})
		);
		await expectSharedInviteSection(root);
	}
};

const onDone = fn();

/**
 * Door A, opened from the calendar's "Neue Person per Direkteinladung …":
 * the medium comes from the Art (Telefon → audio call), and the
 * Direkteinladung opens with "Mit Termin" on and the calendar's time.
 */
export const ChatErstellenFromCalendar: Story = {
	name: 'Chat erstellen · Direkteinladung with the calendar slot · 1440',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => (
		<div className="conversationCreate">
			<div className="conversationCreate__single">
				<DirectLinkCreateCard
					topics={[{ value: '4', label: 'Schulden' }]}
					agencies={[{ id: 88, topicIds: [4] }]}
					media={['CHAT', 'AUDIO', 'VIDEO']}
					onDone={onDone}
					initialMedium="AUDIO"
					preset={{ ...SLOT, kind: 'phone' }}
				/>
			</div>
		</div>
	),
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole('button', { name: 'Audioanruf' })
		).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Link erstellen' })
		);
		const root = await body().findByTestId('invitation-dialog');
		const dialog = within(root);
		await expect(
			dialog.getByRole('switch', { name: 'Mit Termin' })
		).toBeChecked();
		await expect(sections(root)).toEqual(['slot', 'link']);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Erstellen' })
		);
		await waitFor(() =>
			expect(
				directLinkMock().requests.find((r) => r.method === 'POST')?.body
			).toEqual(
				expect.objectContaining({
					medium: 'AUDIO',
					appointment: {
						startTime: SLOT.start.toISOString(),
						endTime: SLOT.end.toISOString()
					}
				})
			)
		);
	}
};
