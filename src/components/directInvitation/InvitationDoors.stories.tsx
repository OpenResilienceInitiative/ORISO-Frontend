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
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
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
 *
 * FE#2510 *2 (Frank, 2026-11-24): in "Neuer Eintrag" the date is optional.
 * "Mit Termin" off creates the open invitation link — no date, valid until
 * deleted, every person gets their own conversation. The calendar hands the
 * Art to "Chat erstellen", which asks topic and name and creates the link
 * as today. "Neuer Eintrag" is the single entry point; the links list has
 * no "+" of its own.
 */
/** FE#2510 *2: the remembered "Mit Termin" setting of the story's counsellor. */
const WITH_DATE_KEY = 'oriso.calendar.newEntryWithDate.me';
const rememberWithDate = (value: 'on' | 'off' | null) => {
	try {
		if (value) window.localStorage.setItem(WITH_DATE_KEY, value);
		else window.localStorage.removeItem(WITH_DATE_KEY);
	} catch {
		// Storage blocked: the default (on) applies.
	}
};

const meta: Meta = {
	title: 'DirectInvitation/One flow — Chat erstellen and calendar',
	parameters: { layout: 'fullscreen' },
	beforeEach: () => rememberWithDate(null)
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
const onCreateOpenLink = fn();
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
	compact = false,
	inviteMedia
}: {
	slot?: { start: Date; end: Date };
	compact?: boolean;
	inviteMedia?: readonly DirectLinkMedium[];
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
		inviteMedia={inviteMedia}
		onInviteNewPerson={onInviteNewPerson}
		onCreateOpenLink={onCreateOpenLink}
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

/**
 * "Direkteinladung erlauben" allows chat and audio links, not video: the
 * link takes the Art's medium, so Video offers no link and says why.
 */
export const CalendarFromSlotVideoNotAllowed: Story = {
	name: 'Calendar slot · video links not allowed · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onSaveAppointment.mockClear(),
	render: () => (
		<CalendarTermin slot={SLOT} inviteMedia={['CHAT', 'AUDIO']} />
	),
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		const invite = () =>
			dialog.getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			});
		await expect(invite()).toBeDisabled();
		await expect(
			dialog.getByText(/Für diese Art sind Direkteinladungen nicht/)
		).toBeInTheDocument();
		await userEvent.click(dialog.getByRole('button', { name: 'Telefon' }));
		await expect(invite()).toBeEnabled();
		await userEvent.click(dialog.getByRole('button', { name: 'Video' }));
		await expect(invite()).toBeDisabled();
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

/** Turns "Mit Termin" off and checks what is left: only the Art. */
const switchToOpenLink = async (root: HTMLElement) => {
	const dialog = within(root);
	const withDate = dialog.getByRole('switch', { name: 'Mit Termin' });
	await expect(withDate).toBeChecked();
	await userEvent.click(withDate);
	await expect(withDate).not.toBeChecked();
	// No date, no conversation: the link makes a new one per person.
	await expect(sections(root)).toEqual(['kind']);
	await expect(root).toHaveTextContent('offener Einladungslink');
	await expect(root).toHaveTextContent('bis Sie ihn löschen');
	await expect(root).toHaveTextContent('Ein Termin ist optional');
	return dialog;
};

/**
 * FE#2510 *2: "Neuer Eintrag" → Termin, date optional. "Mit Termin" off:
 * the open invitation link of "Chat erstellen", with the chosen Art.
 */
export const CalendarOpenLink: Story = {
	name: 'Calendar "Neuer Eintrag" · without date = open invitation link · 1440',
	globals: desktop1440Globals,
	beforeEach: () => {
		onCreateOpenLink.mockClear();
		onSaveAppointment.mockClear();
	},
	render: () => <CalendarTermin />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = await switchToOpenLink(root);
		await userEvent.click(dialog.getByRole('button', { name: 'Telefon' }));
		await userEvent.click(
			dialog.getByRole('button', { name: 'Weiter zum Einladungslink' })
		);
		await expect(onCreateOpenLink).toHaveBeenCalledWith({ kind: 'phone' });
		await expect(onSaveAppointment).not.toHaveBeenCalled();
		await expect(window.localStorage.getItem(WITH_DATE_KEY)).toBe('off');
	}
};

/**
 * Back and forth: "Mit Termin" on again shows the month, Beratung and times
 * as before; nothing typed is lost.
 */
export const CalendarOpenLinkFlipBack: Story = {
	name: 'Calendar "Neuer Eintrag" · "Mit Termin" off and on again · 1440',
	globals: desktop1440Globals,
	render: () => <CalendarTermin />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = await switchToOpenLink(root);
		await userEvent.click(
			dialog.getByRole('switch', { name: 'Mit Termin' })
		);
		await expect(sections(root)).toEqual([
			'conversation',
			'slot',
			'kind',
			'invite'
		]);
		await expect(
			dialog.getByRole('button', { name: 'Anlegen' })
		).toBeInTheDocument();
	}
};

/**
 * The counsellor last created an open link: "Neuer Eintrag" opens with
 * "Mit Termin" off (Frank, 2026-11-24: remember the last setting).
 */
export const CalendarOpenLinkRemembered: Story = {
	name: 'Calendar "Neuer Eintrag" · opens with the last setting (off) · 1440',
	globals: desktop1440Globals,
	beforeEach: () => {
		rememberWithDate('off');
		onSaveAppointment.mockClear();
	},
	render: () => <CalendarTermin />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = within(root);
		const withDate = dialog.getByRole('switch', { name: 'Mit Termin' });
		await expect(withDate).not.toBeChecked();
		await expect(sections(root)).toEqual(['kind']);
		// Switched on and used: the next "Neuer Eintrag" opens with a date.
		await userEvent.click(withDate);
		await userEvent.click(
			dialog.getByRole('combobox', { name: 'Beratung' })
		);
		await userEvent.click(
			await body().findByRole('option', { name: 'mutige_eule' })
		);
		await userEvent.click(dialog.getByRole('button', { name: 'Anlegen' }));
		await expect(onSaveAppointment).toHaveBeenCalled();
		await expect(window.localStorage.getItem(WITH_DATE_KEY)).toBe('on');
	}
};

/** An Art whose medium "Direkteinladung erlauben" does not allow: no link. */
export const CalendarOpenLinkMediumOff: Story = {
	name: 'Calendar "Neuer Eintrag" · open link, video not allowed · 1440',
	globals: desktop1440Globals,
	beforeEach: () => onCreateOpenLink.mockClear(),
	render: () => <CalendarTermin inviteMedia={['CHAT', 'AUDIO']} />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = await switchToOpenLink(root);
		const next = dialog.getByRole('button', {
			name: 'Weiter zum Einladungslink'
		});
		await expect(root).toHaveTextContent(
			'Für diese Art sind Direkteinladungen nicht freigegeben'
		);
		await expect(next).toBeDisabled();
		await userEvent.click(dialog.getByRole('button', { name: 'Chat' }));
		await expect(next).toBeEnabled();
	}
};

/** A selected time slot already is a date: no "Mit Termin" switch. */
export const CalendarFromSlotNoOpenLink: Story = {
	name: 'Calendar slot · date known, no open-link switch · 1440',
	globals: desktop1440Globals,
	render: () => <CalendarTermin slot={SLOT} />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		await expect(
			within(root).queryByRole('switch', { name: 'Mit Termin' })
		).toBeNull();
	}
};

/** The open link at phone width: full screen, nothing cut off. */
export const CalendarOpenLinkPhone: Story = {
	name: 'Calendar "Neuer Eintrag" · without date = open invitation link · 390',
	globals: phone390Globals,
	beforeEach: () => onCreateOpenLink.mockClear(),
	render: () => <CalendarTermin compact />,
	play: async () => {
		const root = await body().findByTestId('calendar-appointment-dialog');
		const dialog = await switchToOpenLink(root);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Weiter zum Einladungslink' })
		);
		await expect(onCreateOpenLink).toHaveBeenCalledWith({ kind: 'video' });
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

const ChatErstellenCard = () => (
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
);

/** Audio preselected from the Art; the dialog opens with the calendar's time. */
const openFromCalendar = async (canvas: ReturnType<typeof within>) => {
	await expect(
		canvas.getByRole('button', { name: 'Audioanruf' })
	).toHaveAttribute('aria-pressed', 'true');
	await userEvent.click(
		canvas.getByRole('button', { name: 'Link erstellen' })
	);
	const root = await body().findByTestId('invitation-dialog');
	await expect(
		within(root).getByRole('switch', { name: 'Mit Termin' })
	).toBeChecked();
	await expect(sections(root)).toEqual(['slot', 'link']);
	return root;
};

/**
 * Door A, opened from the calendar's "Neue Person per Direkteinladung …":
 * the medium comes from the Art (Telefon → audio call), and the
 * Direkteinladung opens with "Mit Termin" on and the calendar's time.
 */
export const ChatErstellenFromCalendarDialog: Story = {
	name: 'Chat erstellen · Direkteinladung opened with the calendar slot · 1440',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => <ChatErstellenCard />,
	play: async ({ canvas }) => {
		await openFromCalendar(canvas);
	}
};

/** The same, saved: the invitation carries the calendar's time. */
export const ChatErstellenFromCalendar: Story = {
	name: 'Chat erstellen · Direkteinladung with the calendar slot · 1440',
	globals: desktop1440Globals,
	beforeEach: () => installDirectLinkMockApi(),
	render: () => <ChatErstellenCard />,
	play: async ({ canvas }) => {
		const root = await openFromCalendar(canvas);
		await userEvent.click(
			within(root).getByRole('button', { name: 'Erstellen' })
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

/**
 * FE#2510 *2, door A after the calendar's open link: the medium comes from
 * the Art, the Direkteinladung opens with "Mit Termin" off, and the link is
 * created without an appointment (valid until deleted).
 */
export const ChatErstellenOpenLinkFromCalendar: Story = {
	name: 'Chat erstellen · open link from the calendar, no date · 1440',
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
		await expect(
			within(root).getByRole('switch', { name: 'Mit Termin' })
		).not.toBeChecked();
		await userEvent.click(
			within(root).getByRole('button', { name: 'Erstellen' })
		);
		await waitFor(() => {
			const post = directLinkMock().requests.find(
				(r) => r.method === 'POST'
			)?.body as Record<string, unknown> | undefined;
			expect(post).toEqual(expect.objectContaining({ medium: 'AUDIO' }));
			expect(post?.appointment).toBeUndefined();
		});
	}
};
