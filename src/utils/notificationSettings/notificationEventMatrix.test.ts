/**
 * The notification matrix (FE#1211, epic #778) as data. Every feed event the
 * frontend knows × role → settings row → channels, and every dialog row →
 * what can fire. The expectations are written out by hand on purpose: when a
 * mapping, a default or a producer changes, this table has to change with it.
 */
import { describe, expect, it } from 'vite-plus/test';
import { KNOWN_EVENT_TYPES } from '../../components/notificationsCenter/eventDescriptors/registry';
import {
	AREA_KINDS,
	DEFAULT_NOTIFICATION_CONFIG,
	NOTIFICATION_AREAS,
	type NotificationArea,
	type NotificationKind
} from './notificationConfig';
import {
	channelCapability,
	EVENT_CASES,
	rowAvailability,
	visibleAreas,
	type EventCase,
	type RowVisibility,
	NOTIFICATION_CHANNELS,
	NOTIFICATION_ROLES,
	rowForCase,
	type NotificationRole,
	type UnavailableReason
} from './notificationChannelCapability';

type Row = `${NotificationArea}/${NotificationKind}`;
const NONE = null;

/** eventType[+variant] → row per recipient role (null = never notifies). */
const EXPECTED_ROW: Record<
	string,
	Partial<Record<NotificationRole, Row | null>>
> = {
	'request.new': { consultant: 'requests/new' },
	'waiting_room.client.joined': { consultant: 'requests/new' },
	'request.denied': { asker: 'requests/standard' },
	'inquiry.accepted': { asker: 'requests/standard' },
	'message.new': {
		consultant: 'conversations/standard',
		asker: 'conversations/standard'
	},
	'message.new+liveChat': { consultant: 'conversations/liveChat' },
	'thread.reply.new': {
		consultant: 'conversations/standard',
		asker: 'conversations/standard'
	},
	'first_response.received': { asker: 'conversations/standard' },
	'conversation.finished': {
		consultant: 'conversations/standard',
		asker: 'conversations/standard'
	},
	'team.discussion.new': { consultant: 'requests/teamDiscussion' },
	'team.discussion.new+mentioned': { consultant: 'requests/mention' },
	'message.new+mentioned': { consultant: 'conversations/mention' },
	'case.handover.consent.requested': { asker: 'conversations/handover' },
	'case.handover.consent.requested+optIn': {
		asker: 'conversations/handover'
	},
	'case.handover.granted': {
		consultant: 'conversations/handover',
		asker: 'conversations/handover'
	},
	'case.handover.consent.declined': {
		consultant: 'conversations/handover'
	},
	'case.handover.offer.received': { consultant: 'conversations/handover' },
	'handover.requested': { consultant: 'conversations/handover' },
	'handover.partial': { consultant: 'conversations/handover' },
	'handover.all_confirmed': { consultant: 'conversations/handover' },
	'handover.auto_confirmed': { consultant: 'conversations/handover' },
	'handover.denied': { consultant: 'conversations/handover' },
	'call.invited': {
		consultant: 'timeCritical/call',
		asker: 'timeCritical/call'
	},
	'call.started': {
		consultant: 'timeCritical/call',
		asker: 'timeCritical/call'
	},
	'call.ended': {
		consultant: 'timeCritical/call',
		asker: 'timeCritical/call'
	},
	'call.missed': {
		consultant: 'timeCritical/call',
		asker: 'timeCritical/call'
	},
	'appointment.requested': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'appointment.scheduled': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'appointment.cancelled': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'appointment.briefing': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'group_chat.reminder': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'group_chat.opened': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	'group_chat.cancelled': {
		consultant: 'timeCritical/appointment',
		asker: 'timeCritical/appointment'
	},
	// System family: banner and tone follow the single system switch; the
	// row below is only where the contract files them.
	'supervisor.added': { consultant: 'conversations/standard' },
	'supervisor.removed': { consultant: 'conversations/standard' },
	'supervisor.assigned': { consultant: 'conversations/standard' },
	'counselor.renamed': { asker: 'conversations/standard' },
	'service.notice.planned': { consultant: 'conversations/standard' },
	'draft.created': { consultant: NONE }
};

/** Event types UserService origin/dev does NOT write (checked 2026-10-28). */
const NOT_EMITTED = [
	'message.new+mentioned',
	'handover.requested',
	'handover.partial',
	'handover.all_confirmed',
	'handover.auto_confirmed',
	'handover.denied',
	'appointment.requested',
	'appointment.scheduled',
	'appointment.cancelled',
	'appointment.briefing',
	'draft.created'
];

/**
 * Cases with an in-app pop-up card (Frank, 28 Oct): live chat, new enquiry,
 * mention (team discussions only: the one producer of params.mentioned), the
 * handover offer a counsellor must act on, and the advice seeker's consent
 * request when their yes is needed (OPT_IN). Handover status steps get none.
 */
const POPUP_CASES = [
	'request.new',
	'waiting_room.client.joined',
	'message.new+liveChat',
	'team.discussion.new+mentioned',
	'case.handover.offer.received',
	'case.handover.consent.requested+optIn'
];

const caseId = (c: { eventType: string; variant?: string }) =>
	c.variant ? `${c.eventType}+${c.variant}` : c.eventType;

describe('event matrix: event × role → row', () => {
	it('lists every event type the registry knows, and nothing else', () => {
		const cased = new Set(EVENT_CASES.map((c) => c.eventType));
		expect([...cased].sort()).toEqual([...KNOWN_EVENT_TYPES].sort());
		expect(new Set(EVENT_CASES.map(caseId)).size).toBe(EVENT_CASES.length);
		expect(Object.keys(EXPECTED_ROW).sort()).toEqual(
			EVENT_CASES.map(caseId).sort()
		);
	});

	it.each(EVENT_CASES.map((c) => [caseId(c), c] as const))(
		'%s lands in its row for every recipient',
		(id, eventCase) => {
			const expected = EXPECTED_ROW[id];
			expect(Object.keys(expected).sort()).toEqual(
				[...eventCase.recipients].sort()
			);
			for (const role of eventCase.recipients) {
				const row = rowForCase(eventCase, role);
				expect(
					row ? `${row.area}/${row.kind}` : null,
					`${id}/${role}`
				).toBe(expected[role]);
			}
		}
	);

	it('marks exactly the unwritten event types as not emitted', () => {
		expect(
			EVENT_CASES.filter((c) => !c.emitted)
				.map(caseId)
				.sort()
		).toEqual([...NOT_EMITTED].sort());
	});

	it('gives a pop-up to live chat, new enquiry, mention and the handover offer only', () => {
		expect(
			EVENT_CASES.filter((c) => c.popupFor?.length)
				.map(caseId)
				.sort()
		).toEqual([...POPUP_CASES].sort());
	});

	it('only ever lands in a row the dialog shows (or in none)', () => {
		for (const eventCase of EVENT_CASES) {
			for (const role of eventCase.recipients) {
				const row = rowForCase(eventCase, role);
				if (!row) continue;
				expect(
					AREA_KINDS[row.area],
					`${caseId(eventCase)}/${role} → ${row.area}/${row.kind}`
				).toContain(row.kind);
			}
		}
	});
});

type Expect = 'all' | UnavailableReason;
/** Per dialog row: what fires for each role. 'all' = pop-up aside, banner + tone fire. */
const EXPECTED_ROW_CAPABILITY: Record<
	Row,
	{ consultant: Expect; asker: Expect }
> = {
	'requests/new': { consultant: 'all', asker: 'notForRole' },
	'requests/teamDiscussion': { consultant: 'all', asker: 'notForRole' },
	'requests/standard': { consultant: 'notForRole', asker: 'all' },
	// Team-discussion mentions are the only mentions that exist today.
	'requests/mention': { consultant: 'all', asker: 'notForRole' },
	'conversations/standard': { consultant: 'all', asker: 'all' },
	'conversations/liveChat': { consultant: 'all', asker: 'notForRole' },
	// Ordinary-chat mentions have no producer yet (UserService#1510).
	'conversations/mention': { consultant: 'notSentYet', asker: 'notForRole' },
	'conversations/handover': { consultant: 'all', asker: 'all' },
	'timeCritical/call': { consultant: 'all', asker: 'all' },
	'timeCritical/appointment': { consultant: 'all', asker: 'all' }
};

/** Rows that raise an in-app pop-up card for the role. */
const EXPECTED_POPUP_ROWS: Record<NotificationRole, Row[]> = {
	consultant: [
		'requests/new',
		'conversations/liveChat',
		'requests/mention',
		'conversations/handover'
	],
	asker: ['conversations/handover']
};

describe('row capability: what can fire per dialog row', () => {
	const rows = NOTIFICATION_AREAS.flatMap((area) =>
		AREA_KINDS[area].map((kind) => `${area}/${kind}` as Row)
	);

	it('covers every row the dialog shows', () => {
		expect([...rows].sort()).toEqual(
			Object.keys(EXPECTED_ROW_CAPABILITY).sort()
		);
	});

	it.each(rows)('%s', (row) => {
		const [area, kind] = row.split('/') as [
			NotificationArea,
			NotificationKind
		];
		for (const role of NOTIFICATION_ROLES) {
			const expected = EXPECTED_ROW_CAPABILITY[row][role];
			for (const channel of ['banner', 'sound'] as const) {
				expect(
					channelCapability(role, area, kind, channel),
					`${row}/${role}/${channel}`
				).toEqual(
					expected === 'all'
						? { fires: true }
						: { fires: false, reason: expected }
				);
			}
			const popup = channelCapability(role, area, kind, 'popup');
			expect(popup.fires, `${row}/${role}/popup`).toBe(
				EXPECTED_POPUP_ROWS[role].includes(row)
			);
		}
	});

	it('knows all three channels', () => {
		expect(NOTIFICATION_CHANNELS).toEqual(['popup', 'banner', 'sound']);
	});
});

describe('row defaults the matrix promises', () => {
	const TONE: Record<Row, string> = {
		'requests/new': 'ton-1',
		'requests/standard': 'none',
		'requests/teamDiscussion': 'ton-2',
		'requests/mention': 'ton-2',
		'conversations/standard': 'none',
		'conversations/liveChat': 'ton-1',
		'conversations/mention': 'ton-2',
		'conversations/handover': 'ton-2',
		'timeCritical/call': 'ring',
		'timeCritical/appointment': 'ton-2'
	};

	it.each(Object.entries(TONE))('%s rings with %s', (row, tone) => {
		const [area, kind] = row.split('/') as [
			NotificationArea,
			NotificationKind
		];
		expect(DEFAULT_NOTIFICATION_CONFIG[area][kind].sound).toBe(tone);
		expect(DEFAULT_NOTIFICATION_CONFIG[area][kind].banner).toBe(
			'temporary'
		);
	});

	it('keeps every pop-up row switched on by default', () => {
		for (const role of NOTIFICATION_ROLES) {
			for (const row of EXPECTED_POPUP_ROWS[role]) {
				const [area, kind] = row.split('/') as [
					NotificationArea,
					NotificationKind
				];
				expect(
					DEFAULT_NOTIFICATION_CONFIG[area][kind].banner,
					row
				).not.toBe('off');
			}
		}
	});
});

/** Frank, 30 Oct: never-firing rows are hidden, not-yet-firing rows disabled. */
const EXPECTED_VISIBILITY: Record<
	Row,
	{ consultant: RowVisibility; asker: RowVisibility }
> = {
	'requests/new': { consultant: 'visible', asker: 'hidden' },
	'requests/teamDiscussion': { consultant: 'visible', asker: 'hidden' },
	'requests/standard': { consultant: 'hidden', asker: 'visible' },
	'requests/mention': { consultant: 'visible', asker: 'hidden' },
	'conversations/standard': { consultant: 'visible', asker: 'visible' },
	'conversations/liveChat': { consultant: 'visible', asker: 'hidden' },
	'conversations/mention': { consultant: 'disabled', asker: 'hidden' },
	'conversations/handover': { consultant: 'visible', asker: 'visible' },
	'timeCritical/call': { consultant: 'visible', asker: 'visible' },
	'timeCritical/appointment': { consultant: 'visible', asker: 'visible' }
};

describe('row availability in the dialog', () => {
	const rows = Object.keys(EXPECTED_VISIBILITY) as Row[];

	it.each(rows)('%s is shown, disabled or hidden per role', (row) => {
		const [area, kind] = row.split('/') as [
			NotificationArea,
			NotificationKind
		];
		for (const role of NOTIFICATION_ROLES) {
			expect(
				rowAvailability(role, area, kind).visibility,
				`${row}/${role}`
			).toBe(EXPECTED_VISIBILITY[row][role]);
		}
	});

	it('shows the neutral dialog while the role is unknown, minus the counsellor-only live-chat row', () => {
		for (const row of rows) {
			const [area, kind] = row.split('/') as [
				NotificationArea,
				NotificationKind
			];
			const availability = rowAvailability(undefined, area, kind);
			expect(availability.visibility, row).toBe(
				kind === 'liveChat' ? 'hidden' : 'visible'
			);
			expect(
				availability.bannerEnabled && availability.soundEnabled
			).toBe(true);
		}
	});

	it('disables (not hides) a row whose event exists but has no producer yet, with a reason', () => {
		const unwritten: EventCase[] = [
			{
				eventType: 'appointment.scheduled',
				recipients: ['consultant', 'asker'],
				emitted: false,
				source: 'none'
			}
		];
		for (const role of NOTIFICATION_ROLES) {
			expect(
				rowAvailability(role, 'timeCritical', 'appointment', unwritten)
			).toEqual({
				visibility: 'disabled',
				bannerEnabled: false,
				soundEnabled: false,
				reasonKey: 'profile.notifications.config.unavailable.notSentYet'
			});
		}
	});

	it('hides no tab for any role today, and drops a tab whose rows are all hidden', () => {
		for (const role of NOTIFICATION_ROLES) {
			expect(
				visibleAreas(
					role,
					NOTIFICATION_AREAS,
					(area) => AREA_KINDS[area]
				)
			).toEqual([...NOTIFICATION_AREAS]);
		}
		expect(
			visibleAreas('asker', NOTIFICATION_AREAS, (area) =>
				area === 'timeCritical' ? ['liveChat'] : AREA_KINDS[area]
			)
		).toEqual(['requests', 'conversations']);
	});
});

describe('target conversation open and visible', () => {
	it('is silent (no card, tone, banner) for exactly live chat, mention and handover pop-up events', () => {
		expect(
			EVENT_CASES.filter((c) => c.silentWhenOpen)
				.map(caseId)
				.sort()
		).toEqual(
			[
				'message.new+liveChat',
				'team.discussion.new+mentioned',
				'case.handover.offer.received',
				'case.handover.consent.requested+optIn'
			].sort()
		);
	});
});
