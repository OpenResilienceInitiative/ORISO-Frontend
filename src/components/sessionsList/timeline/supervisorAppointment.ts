/**
 * The counsellor's next appointment with the conversation's supervisor
 * (FE#2494, Frank 2026-11-24: "zwei Wimpel, wenn ich einen Termin mit der
 * Ratsuchendenperson und einen mit dem Supervisor habe"). It is a colleague
 * appointment of the calendar (FE#2305): UserService names the colleague on
 * the own entry, so the counsellor's own calendar holds it and no second
 * endpoint is needed.
 */
import { useEffect, useState } from 'react';
import {
	apiGetCalendarEntries,
	type AppointmentKindDTO,
	type CalendarEntryDTO
} from '../../../api/apiCalendar';
import { onAppointmentsChanged } from './conversationAppointments';
import type {
	EntryMenuItem,
	EntryModality,
	FutureEntry
} from './timelineModel';

/** How far ahead the header looks: the calendar's own load window. */
export const SUPERVISOR_LOOKAHEAD_DAYS = 60;

const MODALITY: Record<AppointmentKindDTO, EntryModality> = {
	ONSITE: 'location',
	VIDEO: 'video',
	PHONE: 'audio',
	CHAT: 'chat'
};

/**
 * The nearest appointment with that colleague that has not ended yet.
 *
 * Per supervision pair, not per case, on purpose: a colleague appointment
 * carries no case (UserService `ColleagueAppointmentCreateDTO` has only
 * colleague, slot and kind), so every case with this supervisor shows the
 * same next meeting with them.
 */
export const nextColleagueAppointment = (
	entries: CalendarEntryDTO[],
	colleagueId: string,
	now: Date
): CalendarEntryDTO | undefined =>
	entries
		.filter(
			(e) =>
				e.type === 'APPOINTMENT' &&
				e.colleagueId === colleagueId &&
				new Date(e.end).getTime() > now.getTime()
		)
		.sort(
			(a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
		)[0];

/**
 * The pennant's entry. Waiting for the colleague's answer, it shows as a
 * request ("angefragt", dashed), as an advice seeker's request does.
 */
export const colleagueAppointmentEntry = (
	dto: CalendarEntryDTO
): FutureEntry => ({
	key: `colleague-${dto.id}`,
	kind: 'one-to-one',
	title: dto.colleagueName ?? dto.title ?? '',
	start: new Date(dto.start),
	end: new Date(dto.end),
	modality: (dto.kind && MODALITY[dto.kind]) || 'video',
	canDuplicate: false,
	canModerate: true,
	...(dto.matrixRoomId && { matrixRoomId: dto.matrixRoomId }),
	...(dto.colleagueStatus === 'PENDING' && { requested: true as const })
});

type Translate = (key: string) => string;

/**
 * The menu of an appointment with the supervisor. Invited and not answered
 * yet: accept or decline. Otherwise: cancel (it leaves both calendars).
 * Moving goes through the calendar, which asks the colleague (FE#2305).
 */
export const colleagueAppointmentMenu = (
	dto: CalendarEntryDTO,
	t: Translate
): EntryMenuItem[] => {
	const item = (key: string, name: string): EntryMenuItem => ({
		key,
		title: t(`supervision.appointment.menu.${name}.title`),
		description: t(`supervision.appointment.menu.${name}.description`),
		disabled: false
	});
	const answer =
		dto.invited === true && dto.colleagueStatus === 'PENDING'
			? [item('confirm', 'accept'), item('decline', 'decline')]
			: [item('cancel', 'cancel')];
	return [...answer, item('calendar', 'calendar')];
};

/**
 * Loads the own calendar for the next weeks and keeps the appointment with
 * `colleagueId` current when any appointment changes. A failed load shows
 * nothing: the advice seeker's pennant stays as it is.
 */
export const useColleagueAppointment = (colleagueId?: string) => {
	const [found, setFound] = useState<{
		colleagueId: string;
		dto?: CalendarEntryDTO;
	}>();
	const [reload, setReload] = useState(0);
	useEffect(() => onAppointmentsChanged(() => setReload((n) => n + 1)), []);
	useEffect(() => {
		if (!colleagueId) return undefined;
		const controller = new AbortController();
		const now = new Date();
		const to = new Date(now.getTime() + SUPERVISOR_LOOKAHEAD_DAYS * 864e5);
		apiGetCalendarEntries(now, to, controller.signal).then(
			(entries) =>
				setFound({
					colleagueId,
					dto: Array.isArray(entries)
						? nextColleagueAppointment(
								entries,
								colleagueId,
								new Date()
							)
						: undefined
				}),
			() => !controller.signal.aborted && setFound({ colleagueId })
		);
		return () => controller.abort();
	}, [colleagueId, reload]);
	return found && found.colleagueId === colleagueId ? found.dto : undefined;
};
