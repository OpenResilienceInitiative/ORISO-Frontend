/**
 * The calendar's "Termin" (tab of "Neuer Eintrag") is the shared invitation
 * form of "Chat erstellen" and of "Termin anlegen" in a 1:1 — one flow, three
 * doors. The calendar only says what it already knows:
 *
 * - a timed slot gives the time, a slot with a kind the Art (not asked again);
 * - opened from "+", the month shows next to the fields (prototype v17);
 * - the conversation is asked, with "Neue Person per Direkteinladung …" for
 *   someone who has none yet (hands the slot to "Chat erstellen");
 * - "Weitere Personen per Link einladen" where "Direkteinladung erlauben"
 *   allows it, as in the 1:1;
 * - overlaps with own entries are named, and the action says "Trotzdem
 *   anlegen".
 */
import * as React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { useInvitationForm } from '../directInvitation/InvitationDialog';
import type {
	InvitationDialogValue,
	InvitationPreset
} from '../directInvitation/invitationModel';
import type { AppointmentFormProps, DialogForm } from './AppointmentDialog';
import { FacetIcon } from './CalendarEntryGlyph';
import {
	findConflicts,
	isWholeDays,
	type AppointmentDraft
} from './calendarModel';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';

const DEFAULT_HOUR = 10;

export interface CalendarInvitationFormProps extends AppointmentFormProps {
	/** "Weitere Personen per Link einladen" ("Direkteinladung erlauben"). */
	allowGuestInvite?: boolean;
	/** "Neue Person per Direkteinladung …": open "Chat erstellen" with this slot. */
	onInviteNewPerson?: (preset: InvitationPreset) => void;
}

/** The form's value as the calendar's draft (with the link, if any). */
export const draftFromInvitation = (
	value: InvitationDialogValue
): AppointmentDraft | undefined =>
	value.appointment
		? {
				type: 'appointment',
				start: value.appointment.start,
				end: value.appointment.end,
				...(value.kind ? { kind: value.kind } : {}),
				...(value.sessionId !== undefined
					? { sessionId: value.sessionId }
					: {}),
				...(value.link ? { link: value.link } : {})
			}
		: undefined;

export const useCalendarInvitationForm = ({
	slot,
	initialSessionId,
	conversations,
	entries,
	ownerId,
	now,
	onSave,
	onClose,
	allowGuestInvite = false,
	onInviteNewPerson
}: CalendarInvitationFormProps): DialogForm => {
	const { t } = useTranslation();
	const format = useRangeFormat();
	const label = useEntryLabel();
	// A month selection covers whole days: an appointment still needs its
	// times, so the form asks for them. A timed slot keeps its end date.
	const timedSlot = slot && !isWholeDays(slot) ? slot : undefined;
	const start = timedSlot
		? timedSlot.start
		: (slot ? dayjs(slot.start) : dayjs(now).add(1, 'day'))
				.hour(DEFAULT_HOUR)
				.minute(0)
				.second(0)
				.millisecond(0)
				.toDate();
	const end = timedSlot?.end ?? dayjs(start).add(1, 'hour').toDate();

	const form = useInvitationForm({
		variant: 'appointment',
		initial: { start, end, ...(slot?.kind ? { kind: slot.kind } : {}) },
		known: { slot: Boolean(timedSlot), kind: Boolean(slot?.kind) },
		withKind: true,
		conversations: {
			options: conversations.map((c) => ({
				sessionId: c.sessionId,
				label: c.username
			})),
			initial: initialSessionId,
			onInviteNewPerson
		},
		allowGuestInvite,
		dateLayout: slot ? 'field' : 'month',
		conflicts: (range) => {
			const found = findConflicts(range, entries, ownerId);
			return found.length
				? {
						note: t('calendar.dialog.conflict', {
							list: found
								.map(
									(c) =>
										`${label(c)} (${format(c.start, c.end)})`
								)
								.join(', ')
						}),
						actionLabel: t('calendar.dialog.saveAnyway')
					}
				: undefined;
		},
		now,
		description: timedSlot
			? format(timedSlot.start, timedSlot.end)
			: t('calendar.dialog.description'),
		// Every creation dialog has an icon above its title (Frank, *1).
		icon: slot?.kind ? (
			<FacetIcon facet={slot.kind} />
		) : (
			<EventOutlinedIcon />
		),
		testIds: {
			root: 'calendar-appointment-dialog',
			submit: 'calendar-appointment-save'
		},
		onSubmit: (value) => {
			const draft = draftFromInvitation(value);
			if (draft) onSave(draft);
		},
		onClose
	});

	return {
		testId: form.testId,
		description: form.description,
		icon: form.icon,
		width: form.width,
		actions: form.actions,
		content: form.content
	};
};
