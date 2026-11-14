/**
 * Sample week for the calendar stories. Synthetic usernames only; no real
 * person, agency or address. Dates are built around a fixed Monday so the
 * stories and their play tests look the same every day.
 */
import type {
	CalendarConversation,
	CalendarEntry,
	Colleague
} from './calendarModel';

/** Monday 16 November 2026, 09:50 local time. */
export const STORY_NOW = new Date(2026, 10, 16, 9, 50);

const at = (dayOffset: number, hour: number, minute = 0) =>
	new Date(2026, 10, 16 + dayOffset, hour, minute).toISOString();

export const ME = 'me';

export const CONVERSATIONS: CalendarConversation[] = [
	{ sessionId: 4401, username: 'ruhiges_yak' },
	{ sessionId: 4402, username: 'mutige_eule' },
	{ sessionId: 4403, username: 'stiller_fuchs' },
	{ sessionId: 4404, username: 'helle_wolke' }
];

export const COLLEAGUES: Colleague[] = [
	{
		id: 'kaya',
		displayName: 'A. Kaya',
		agencyName: 'Beratungsstelle Nord',
		relation: 'sameAgency'
	},
	{
		id: 'brandt',
		displayName: 'J. Brandt',
		agencyName: 'Beratungsstelle Süd',
		relation: 'sameTenant'
	},
	{
		id: 'okafor',
		displayName: 'M. Okafor',
		agencyName: 'Anderer Träger',
		relation: 'otherTenant'
	}
];

export const OWN_ENTRIES: CalendarEntry[] = [
	{
		id: 'a1',
		type: 'appointment',
		kind: 'video',
		ownerId: ME,
		sessionId: 4401,
		title: 'ruhiges_yak',
		start: at(0, 10),
		end: at(0, 11)
	},
	{
		id: 'a2',
		type: 'appointment',
		kind: 'phone',
		ownerId: ME,
		sessionId: 4402,
		title: 'mutige_eule',
		start: at(0, 14),
		end: at(0, 14, 45)
	},
	{
		id: 'a3',
		type: 'appointment',
		kind: 'onsite',
		ownerId: ME,
		sessionId: 4403,
		title: 'stiller_fuchs',
		address: 'Musterstraße 1, 12345 Musterstadt',
		start: at(1, 9),
		end: at(1, 10)
	},
	{
		id: 'g1',
		type: 'group',
		ownerId: ME,
		title: 'Selbsthilfegruppe Dienstag',
		start: at(1, 17),
		end: at(1, 18, 30)
	},
	{
		id: 'a4',
		type: 'appointment',
		kind: 'chat',
		ownerId: ME,
		sessionId: 4404,
		title: 'helle_wolke',
		start: at(2, 11),
		end: at(2, 11, 30)
	},
	{
		id: 'b1',
		type: 'blocker',
		ownerId: ME,
		title: 'Teamsitzung',
		start: at(2, 8),
		end: at(2, 10)
	},
	{ id: 'x1', type: 'busy', ownerId: ME, start: at(3, 13), end: at(3, 15) },
	{
		id: 'a5',
		type: 'appointment',
		kind: 'video',
		ownerId: ME,
		sessionId: 4402,
		title: 'mutige_eule',
		start: at(4, 10),
		end: at(4, 11)
	},
	{
		id: 'a6',
		type: 'appointment',
		kind: 'phone',
		ownerId: ME,
		sessionId: 4401,
		title: 'ruhiges_yak',
		start: at(7, 15),
		end: at(7, 16)
	}
];

/**
 * Colleagues' entries as UserService would send them: time and kind, and
 * the username only where the Träger allows it (the stories redact).
 */
export const COLLEAGUE_ENTRIES: CalendarEntry[] = [
	{
		id: 'k1',
		type: 'appointment',
		kind: 'video',
		ownerId: 'kaya',
		title: 'frohe_amsel',
		start: at(0, 11),
		end: at(0, 12)
	},
	{
		id: 'k2',
		type: 'appointment',
		kind: 'onsite',
		ownerId: 'kaya',
		title: 'wache_kraehe',
		start: at(1, 10),
		end: at(1, 11)
	},
	{
		id: 'k3',
		type: 'blocker',
		ownerId: 'kaya',
		title: 'Arzttermin',
		start: at(3, 8),
		end: at(3, 12)
	},
	{
		id: 'j1',
		type: 'appointment',
		kind: 'phone',
		ownerId: 'brandt',
		title: 'flinke_maus',
		start: at(0, 13),
		end: at(0, 14)
	},
	{
		id: 'o1',
		type: 'appointment',
		kind: 'chat',
		ownerId: 'okafor',
		title: 'kluger_rabe',
		start: at(2, 15),
		end: at(2, 16)
	}
];

/** An advice seeker's own appointments: the counsellor's name as title. */
export const ASKER_ENTRIES: CalendarEntry[] = [
	{
		id: 's1',
		type: 'appointment',
		kind: 'video',
		ownerId: 'asker',
		sessionId: 4401,
		title: 'Beraterin ORISO',
		start: at(0, 10),
		end: at(0, 11)
	},
	{
		id: 's2',
		type: 'appointment',
		kind: 'onsite',
		ownerId: 'asker',
		sessionId: 4401,
		title: 'Beraterin ORISO',
		address: 'Musterstraße 1, 12345 Musterstadt',
		start: at(3, 9),
		end: at(3, 10)
	},
	{
		id: 's3',
		type: 'group',
		ownerId: 'asker',
		title: 'Selbsthilfegruppe Dienstag',
		start: at(1, 17),
		end: at(1, 18, 30)
	}
];

export const FEED_URL =
	'https://app.oriso.org/service/users/calendar/feed/9f3c2a7e5b1d4c8a.ics';
