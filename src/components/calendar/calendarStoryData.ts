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
import type { MoveProposal } from './calendarActions';
import type { WorkingHours } from './calendarWorkingHours';

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

const NORTH = 'Beratungsstelle Nord';
const SOUTH = 'Beratungsstelle Süd';

export const COLLEAGUES: Colleague[] = [
	{
		id: 'kaya',
		displayName: 'A. Kaya',
		agencyName: NORTH,
		agencyShort: 'BS-N',
		relation: 'sameAgency'
	},
	{
		id: 'demir',
		displayName: 'E. Demir',
		agencyName: NORTH,
		agencyShort: 'BS-N',
		relation: 'sameAgency'
	},
	{
		id: 'hoffmann',
		displayName: 'K. Hoffmann',
		agencyName: NORTH,
		agencyShort: 'BS-N',
		relation: 'sameAgency'
	},
	{
		id: 'schulz',
		displayName: 'S. Schulz',
		agencyName: NORTH,
		agencyShort: 'BS-N',
		relation: 'sameAgency'
	},
	{
		id: 'brandt',
		displayName: 'J. Brandt',
		agencyName: SOUTH,
		agencyShort: 'BS-S',
		relation: 'sameTenant'
	},
	{
		id: 'meier',
		displayName: 'L. Meier',
		agencyName: SOUTH,
		agencyShort: 'BS-S',
		relation: 'sameTenant'
	},
	{
		id: 'nowak',
		displayName: 'P. Nowak',
		agencyName: SOUTH,
		agencyShort: 'BS-S',
		relation: 'sameTenant'
	},
	{
		id: 'okafor',
		displayName: 'M. Okafor',
		agencyName: 'Anderer Träger',
		relation: 'otherTenant'
	}
];

/** Monday to Friday, 08:00 to 18:00. */
export const STORY_WORKING_HOURS: WorkingHours = [1, 2, 3, 4, 5].map(
	(weekday) => ({ weekday, start: '08:00', end: '18:00' })
);

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
		id: 'b2',
		type: 'blocker',
		ownerId: ME,
		title: 'Fortbildung',
		allDay: true,
		start: at(3, 0),
		end: at(4, 0)
	},
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
		id: 'd1',
		type: 'appointment',
		kind: 'video',
		ownerId: 'demir',
		title: 'leise_robbe',
		start: at(0, 9),
		end: at(0, 10)
	},
	{
		id: 'd2',
		type: 'group',
		ownerId: 'demir',
		title: 'Teambesprechung Nord',
		start: at(0, 15),
		end: at(0, 16)
	},
	{
		id: 'h1',
		type: 'appointment',
		kind: 'onsite',
		ownerId: 'hoffmann',
		title: 'wilde_hummel',
		start: at(0, 12),
		end: at(0, 13)
	},
	{
		id: 'h2',
		type: 'blocker',
		ownerId: 'hoffmann',
		start: at(0, 16),
		end: at(0, 18)
	},
	{
		id: 's1c',
		type: 'appointment',
		kind: 'phone',
		ownerId: 'schulz',
		title: 'bunte_meise',
		start: at(0, 8),
		end: at(0, 9)
	},
	{
		id: 'm1',
		type: 'appointment',
		kind: 'chat',
		ownerId: 'meier',
		title: 'kleiner_otter',
		start: at(0, 10, 30),
		end: at(0, 11)
	},
	{
		id: 'n1',
		type: 'appointment',
		kind: 'video',
		ownerId: 'nowak',
		title: 'sanfte_taube',
		start: at(0, 14, 30),
		end: at(0, 15, 30)
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

/** A pending proposal: A. Kaya's video call on Monday, asked to move to 16:00. */
export const STORY_PROPOSALS: MoveProposal[] = [
	{ id: 'p1', entryId: 'k1', start: at(0, 16), end: at(0, 17) }
];
