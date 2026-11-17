/**
 * The line a 1:1 appointment change leaves in its conversation (FE#1960),
 * drawn as an appointment card instead of a plain bubble.
 *
 * Since this change the notice travels as a `[SYSTEM_NOTIFICATION]` payload:
 * the slot as timestamps (worded in the reader's own language and time zone),
 * the slot before a move, and the old sentence as `description`, which list
 * previews and older clients keep showing. Notices sent before were plain
 * sentences ("Termin abgesagt: Mi 18. Nov 10:00–11:00"); those are recognised
 * by their sentence, in every language the app shipped them in.
 */

export const SYSTEM_NOTIFICATION_APPOINTMENT = 'APPOINTMENT_NOTICE';

export type AppointmentNoticeKind = 'created' | 'moved' | 'cancelled';

const KINDS: AppointmentNoticeKind[] = ['created', 'moved', 'cancelled'];

export interface AppointmentNoticeSlot {
	start: Date;
	end?: Date;
}

/** A notice the card can draw. */
export type AppointmentNotice =
	| {
			kind: AppointmentNoticeKind;
			/** From the payload: worded by the reader. */
			slot: AppointmentNoticeSlot;
			/** A move: where it stood before. */
			previous?: AppointmentNoticeSlot;
	  }
	| {
			kind: AppointmentNoticeKind;
			/** From an old plain sentence: the sender's own wording. */
			slotText: string;
	  };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

const toDate = (value: unknown): Date | undefined => {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : undefined;
};

const toSlot = (
	start: unknown,
	end: unknown
): AppointmentNoticeSlot | undefined => {
	const from = toDate(start);
	if (!from) return undefined;
	const to = toDate(end);
	return to && to.getTime() > from.getTime()
		? { start: from, end: to }
		: { start: from };
};

/** The `[SYSTEM_NOTIFICATION]` JSON for one change. */
export const buildAppointmentNoticePayload = ({
	kind,
	start,
	end,
	previousStart,
	previousEnd,
	description
}: {
	kind: AppointmentNoticeKind;
	start: Date;
	end?: Date;
	previousStart?: Date;
	previousEnd?: Date;
	/** The sentence previews and older clients show. */
	description: string;
}): string =>
	JSON.stringify({
		type: SYSTEM_NOTIFICATION_APPOINTMENT,
		description,
		appointment: {
			kind,
			start: start.toISOString(),
			...(end && { end: end.toISOString() }),
			...(kind === 'moved' &&
				previousStart && {
					previousStart: previousStart.toISOString(),
					...(previousEnd && {
						previousEnd: previousEnd.toISOString()
					})
				})
		}
	});

/** The parsed `[SYSTEM_NOTIFICATION]` JSON; null for anything else. */
export const parseAppointmentNoticePayload = (
	payload: unknown
): AppointmentNotice | null => {
	if (!isRecord(payload)) return null;
	if (payload.type !== SYSTEM_NOTIFICATION_APPOINTMENT) return null;
	const { appointment } = payload;
	if (!isRecord(appointment)) return null;
	const kind = appointment.kind as AppointmentNoticeKind;
	if (!KINDS.includes(kind)) return null;
	const slot = toSlot(appointment.start, appointment.end);
	if (!slot) return null;
	const previous =
		kind === 'moved'
			? toSlot(appointment.previousStart, appointment.previousEnd)
			: undefined;
	return previous ? { kind, slot, previous } : { kind, slot };
};

/**
 * The sentences notices were sent as before they carried a payload, per
 * language (`sessionList.timeline.appointment.notice.*` as shipped; a test
 * keeps them equal). The sender wrote in their own language, so all count.
 */
export const LEGACY_NOTICE_SENTENCES: Record<
	string,
	Record<AppointmentNoticeKind, string>
> = {
	de: {
		created: 'Termin vereinbart: {{date}}',
		moved: 'Termin verschoben auf: {{date}}',
		cancelled: 'Termin abgesagt: {{date}}'
	},
	en: {
		created: 'Appointment scheduled: {{date}}',
		moved: 'Appointment moved to: {{date}}',
		cancelled: 'Appointment cancelled: {{date}}'
	},
	fr: {
		created: 'Rendez-vous fixé : {{date}}',
		moved: 'Rendez-vous déplacé au : {{date}}',
		cancelled: 'Rendez-vous annulé : {{date}}'
	},
	ru: {
		created: 'Встреча назначена: {{date}}',
		moved: 'Встреча перенесена на: {{date}}',
		cancelled: 'Встреча отменена: {{date}}'
	},
	ti: {
		created: 'ቆጸራ ተሓዚ፦ {{date}}',
		moved: 'ቆጸራ ናብ ተቐይሩ፦ {{date}}',
		cancelled: 'ቆጸራ ተሰሪዙ፦ {{date}}'
	},
	tr: {
		created: 'Randevu belirlendi: {{date}}',
		moved: 'Randevu şu tarihe ertelendi: {{date}}',
		cancelled: 'Randevu iptal edildi: {{date}}'
	}
};

const LEGACY_PREFIXES: { kind: AppointmentNoticeKind; prefix: string }[] =
	Object.values(LEGACY_NOTICE_SENTENCES).flatMap((sentences) =>
		KINDS.map((kind) => ({
			kind,
			prefix: sentences[kind].replace('{{date}}', '')
		}))
	);

/** The slot never runs over a line; a longer text is someone's message. */
const MAX_SLOT_LENGTH = 60;

/** An old plain-sentence notice; null for any other text. */
export const recognizeLegacyAppointmentNotice = (
	text?: string | null
): AppointmentNotice | null => {
	const value = text?.trim();
	if (!value) return null;
	for (const { kind, prefix } of LEGACY_PREFIXES) {
		if (!value.startsWith(prefix)) continue;
		const slotText = value.slice(prefix.length).trim();
		if (
			slotText &&
			slotText.length <= MAX_SLOT_LENGTH &&
			!slotText.includes('\n') &&
			/\d/.test(slotText)
		)
			return { kind, slotText };
	}
	return null;
};

/** What the card may offer the person looking at it. */
export type AppointmentNoticeAction = 'createNew' | 'openCalendar';

export const appointmentNoticeActions = ({
	notice,
	canCreate,
	hasUpcoming,
	canOpenCalendar
}: {
	notice: AppointmentNotice;
	/**
	 * This viewer may create an appointment in this conversation right now:
	 * the same rule as the room's ⋮ "Termin anlegen" (its counsellor, the
	 * conversation running).
	 */
	canCreate: boolean;
	/** The conversation already has a coming appointment. */
	hasUpcoming: boolean;
	/** This viewer has "Meine Termine" and the card knows the day. */
	canOpenCalendar: boolean;
}): AppointmentNoticeAction[] => {
	if (notice.kind === 'cancelled')
		return canCreate && !hasUpcoming ? ['createNew'] : [];
	return canOpenCalendar && 'slot' in notice ? ['openCalendar'] : [];
};

/** `YYYY-MM-DD` of the local day, for the calendar's `?date=`. */
export const calendarDayParam = (date: Date): string =>
	[
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0')
	].join('-');

/** The local day a `?date=` names; undefined when it names none. */
export const parseCalendarDayParam = (value?: string | null) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
	if (!match) return undefined;
	const [, year, month, day] = match.map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
		? date
		: undefined;
};
