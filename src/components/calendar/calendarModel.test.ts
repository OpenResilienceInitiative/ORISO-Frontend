import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import {
	colleaguesInScope,
	daySpan,
	draftError,
	expandBlocker,
	isWholeDays,
	MAX_BLOCKER_OCCURRENCES,
	findConflicts,
	isMovable,
	isSoon,
	kindFromLocation,
	neutralFeedEvent,
	redactForColleague,
	settleMove,
	upcomingEntries,
	visibleHours,
	type CalendarEntry,
	type Colleague
} from './calendarModel';

const entry = (over: Partial<CalendarEntry>): CalendarEntry => ({
	id: 'e1',
	type: 'appointment',
	start: '2026-11-16T09:00:00Z',
	end: '2026-11-16T10:00:00Z',
	ownerId: 'me',
	...over
});

describe('kindFromLocation', () => {
	it('maps the stored location values to the four kinds', () => {
		expect(kindFromLocation('IN_PERSON')).toBe('onsite');
		expect(kindFromLocation('VIDEO_CALL')).toBe('video');
		expect(kindFromLocation('LINK')).toBe('video');
		expect(kindFromLocation('PHONE_CALL')).toBe('phone');
		expect(kindFromLocation('USER_PHONE')).toBe('phone');
		expect(kindFromLocation('CHAT')).toBe('chat');
		expect(kindFromLocation(undefined)).toBeUndefined();
	});
});

describe('colleaguesInScope', () => {
	const colleagues: Colleague[] = [
		{ id: 'a', displayName: 'A', agencyName: 'X', relation: 'sameAgency' },
		{ id: 't', displayName: 'T', agencyName: 'Y', relation: 'sameTenant' },
		{ id: 'p', displayName: 'P', agencyName: 'Z', relation: 'otherTenant' }
	];
	const ids = (scope: 'AGENCY' | 'TENANT' | 'PLATFORM') =>
		colleaguesInScope(colleagues, scope).map((c) => c.id);

	it('widens from counselling centre to Träger to platform', () => {
		expect(ids('AGENCY')).toEqual(['a']);
		expect(ids('TENANT')).toEqual(['a', 't']);
		expect(ids('PLATFORM')).toEqual(['a', 't', 'p']);
	});
});

describe('redactForColleague', () => {
	const own = entry({
		title: 'ruhiges_yak',
		kind: 'onsite',
		address: 'Hauptstraße 1',
		sessionId: 7
	});

	it('keeps only time, busy and kind by default', () => {
		const seen = redactForColleague(own, {
			scope: 'AGENCY',
			showUsernames: false
		});
		expect(seen).toEqual({
			id: own.id,
			type: 'appointment',
			start: own.start,
			end: own.end,
			ownerId: 'me',
			kind: 'onsite',
			title: undefined
		});
	});

	it('adds the username only when the Träger allows it', () => {
		expect(
			redactForColleague(own, { scope: 'AGENCY', showUsernames: true })
				.title
		).toBe('ruhiges_yak');
	});

	it('never shows a blocker note or imported busy time as such', () => {
		const note = entry({ type: 'blocker', title: 'Arzttermin' });
		expect(
			redactForColleague(note, { scope: 'AGENCY', showUsernames: true })
				.title
		).toBeUndefined();
		expect(
			redactForColleague(entry({ type: 'busy' }), {
				scope: 'AGENCY',
				showUsernames: true
			}).type
		).toBe('blocker');
	});
});

describe('findConflicts', () => {
	const entries = [
		entry({ id: 'a' }),
		entry({
			id: 'b',
			type: 'busy',
			start: '2026-11-16T12:00:00Z',
			end: '2026-11-16T13:00:00Z'
		}),
		entry({ id: 'c', ownerId: 'colleague' })
	];

	it('finds own entries of any type that overlap', () => {
		const hits = findConflicts(
			{ start: '2026-11-16T09:30:00Z', end: '2026-11-16T12:30:00Z' },
			entries,
			'me'
		);
		expect(hits.map((e) => e.id)).toEqual(['a', 'b']);
	});

	it('ignores touching edges and the entry being moved', () => {
		expect(
			findConflicts(
				{ start: '2026-11-16T10:00:00Z', end: '2026-11-16T11:00:00Z' },
				entries,
				'me'
			)
		).toEqual([]);
		expect(
			findConflicts(
				{ start: '2026-11-16T09:15:00Z', end: '2026-11-16T09:45:00Z' },
				entries,
				'me',
				'a'
			)
		).toEqual([]);
	});
});

describe('upcomingEntries and isSoon', () => {
	const now = new Date('2026-11-16T08:50:00Z');

	it('lists own appointments and group dates in time order', () => {
		const list = upcomingEntries(
			[
				entry({
					id: 'late',
					start: '2026-11-17T09:00:00Z',
					end: '2026-11-17T10:00:00Z'
				}),
				entry({ id: 'early' }),
				entry({ id: 'blocker', type: 'blocker' }),
				entry({
					id: 'past',
					start: '2026-11-15T09:00:00Z',
					end: '2026-11-15T10:00:00Z'
				})
			],
			'me',
			now
		);
		expect(list.map((e) => e.id)).toEqual(['early', 'late']);
	});

	it('marks an entry soon from 15 minutes before its start', () => {
		expect(isSoon(entry({}), now)).toBe(true);
		expect(isSoon(entry({}), new Date('2026-11-16T08:40:00Z'))).toBe(false);
		expect(isSoon(entry({}), new Date('2026-11-16T10:00:00Z'))).toBe(false);
	});
});

describe('neutralFeedEvent', () => {
	it('carries no name, kind or note', () => {
		const event = neutralFeedEvent(
			entry({ title: 'ruhiges_yak', kind: 'video' }),
			'https://app.oriso.org/'
		);
		expect(event).toEqual({
			summary: 'ORISO-Termin',
			start: '2026-11-16T09:00:00Z',
			end: '2026-11-16T10:00:00Z',
			url: 'https://app.oriso.org/booking/events'
		});
	});
});

describe('expandBlocker', () => {
	// Monday 16 Nov 2026, 08:00–12:00 local time.
	const first = {
		start: new Date(2026, 10, 16, 8, 0),
		end: new Date(2026, 10, 16, 12, 0)
	};

	it('is the single range without a repeat', () => {
		expect(expandBlocker(first)).toEqual([first]);
	});

	it('repeats every Monday up to and including the last day', () => {
		const ranges = expandBlocker(first, {
			weekdays: [1],
			until: new Date(2026, 11, 7)
		});
		expect(ranges.map((r) => r.start.getDate())).toEqual([16, 23, 30, 7]);
		expect(ranges.every((r) => r.end.getHours() === 12)).toBe(true);
	});

	it('covers several weekdays and stops at the safety bound', () => {
		const twoDays = expandBlocker(first, {
			weekdays: [1, 3],
			until: new Date(2026, 10, 25)
		});
		expect(twoDays.map((r) => r.start.getDate())).toEqual([16, 18, 23, 25]);
		expect(
			expandBlocker(first, {
				weekdays: [0, 1, 2, 3, 4, 5, 6],
				until: new Date(2030, 0, 1)
			})
		).toHaveLength(MAX_BLOCKER_OCCURRENCES);
	});
});

describe('expandBlocker across a daylight-saving change (Europe/Berlin)', () => {
	const runnerZone = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = 'Europe/Berlin';
	});
	afterAll(() => {
		if (runnerZone === undefined) delete process.env.TZ;
		else process.env.TZ = runnerZone;
	});
	const clock = (d: Date) =>
		`${d.getDate()}. ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

	it('keeps 00:00–04:00 on the 23-hour day in March', () => {
		// Sundays 21 and 28 March 2027; clocks go forward on the 28th.
		const ranges = expandBlocker(
			{
				start: new Date(2027, 2, 21, 0, 0),
				end: new Date(2027, 2, 21, 4, 0)
			},
			{ weekdays: [0], until: new Date(2027, 2, 28) }
		);
		expect(ranges.map((r) => `${clock(r.start)}–${clock(r.end)}`)).toEqual(
			['21. 0:00–21. 4:00', '28. 0:00–28. 4:00']
		);
	});

	it('keeps 00:00–04:00 on the 25-hour day in October', () => {
		// Sundays 18 and 25 October 2026; clocks go back on the 25th.
		const ranges = expandBlocker(
			{
				start: new Date(2026, 9, 18, 0, 0),
				end: new Date(2026, 9, 18, 4, 0)
			},
			{ weekdays: [0], until: new Date(2026, 9, 25) }
		);
		expect(clock(ranges[1].end)).toBe('25. 4:00');
	});

	it('ends an all-day blocker at the end of its own day', () => {
		const start = new Date(2027, 2, 21, 0, 0);
		const end = new Date(2027, 2, 21, 23, 59, 59, 999);
		const [, spring] = expandBlocker(
			{ start, end },
			{ weekdays: [0], until: new Date(2027, 2, 28) }
		);
		expect(spring.end.getDate()).toBe(28);
		expect(spring.end.getHours()).toBe(23);
		expect(spring.end.getMinutes()).toBe(59);
	});

	it('keeps the day span of a range that crosses midnight', () => {
		const [, second] = expandBlocker(
			{
				start: new Date(2027, 2, 20, 22, 0),
				end: new Date(2027, 2, 21, 6, 0)
			},
			{ weekdays: [6], until: new Date(2027, 2, 27) }
		);
		expect(clock(second.start)).toBe('27. 22:00');
		expect(clock(second.end)).toBe('28. 6:00');
	});

	it('counts local days, not 24-hour blocks', () => {
		expect(
			daySpan(new Date(2027, 2, 27, 12), new Date(2027, 2, 29, 0, 30))
		).toBe(2);
	});
});

describe('expandBlocker limit', () => {
	it('can expand one past the bound, so a caller sees the cut', () => {
		const first = {
			start: new Date(2026, 10, 16, 8, 0),
			end: new Date(2026, 10, 16, 12, 0)
		};
		expect(
			expandBlocker(
				first,
				{ weekdays: [0, 1, 2, 3, 4, 5, 6], until: new Date(2030, 0, 1) },
				MAX_BLOCKER_OCCURRENCES + 1
			)
		).toHaveLength(MAX_BLOCKER_OCCURRENCES + 1);
	});
});

describe('isWholeDays', () => {
	it('is a midnight-to-midnight selection', () => {
		expect(
			isWholeDays({
				start: new Date(2026, 10, 16),
				end: new Date(2026, 10, 17)
			})
		).toBe(true);
		expect(
			isWholeDays({
				start: new Date(2026, 10, 16, 23),
				end: new Date(2026, 10, 17)
			})
		).toBe(false);
	});
});

describe('isMovable and draftError', () => {
	it('lets counsellors move only their own appointments and blockers', () => {
		expect(isMovable(entry({}), 'me', 'consultant')).toBe(true);
		expect(isMovable(entry({ type: 'blocker' }), 'me', 'consultant')).toBe(
			true
		);
		expect(isMovable(entry({ type: 'group' }), 'me', 'consultant')).toBe(
			false
		);
		expect(isMovable(entry({ ownerId: 'x' }), 'me', 'consultant')).toBe(
			false
		);
		expect(isMovable(entry({}), 'me', 'asker')).toBe(false);
	});

	it('explains why a draft cannot be saved', () => {
		const now = new Date('2026-11-16T08:00:00Z');
		const start = new Date('2026-11-16T09:00:00Z');
		const end = new Date('2026-11-16T10:00:00Z');
		expect(draftError({ type: 'appointment' }, now)).toBe('incomplete');
		expect(
			draftError({ type: 'appointment', start: end, end: start }, now)
		).toBe('order');
		expect(
			draftError(
				{ type: 'appointment', start, end },
				new Date('2026-11-16T09:30:00Z')
			)
		).toBe('past');
		expect(draftError({ type: 'appointment', start, end }, now)).toBe(
			'conversation'
		);
		expect(
			draftError({ type: 'appointment', start, end, sessionId: 1 }, now)
		).toBeUndefined();
		expect(
			draftError({ type: 'blocker', start, end }, now)
		).toBeUndefined();
	});
});

describe('settleMove', () => {
	it('puts the entry back when the move is refused', () => {
		const revert = vi.fn();
		settleMove(false, revert);
		expect(revert).toHaveBeenCalledTimes(1);
	});

	it('puts the entry back when saving fails or reports false', async () => {
		const revert = vi.fn();
		settleMove(Promise.reject(new Error('500')), revert);
		settleMove(Promise.resolve(false), revert);
		await Promise.resolve();
		await Promise.resolve();
		expect(revert).toHaveBeenCalledTimes(2);
	});

	it('leaves a stored move where it was dropped', async () => {
		const revert = vi.fn();
		settleMove(undefined, revert);
		settleMove(true, revert);
		settleMove(Promise.resolve(), revert);
		await Promise.resolve();
		expect(revert).not.toHaveBeenCalled();
	});
});

describe('visibleHours', () => {
	const at = (day: number, hour: number, minute = 0) =>
		new Date(2026, 10, day, hour, minute).toISOString();

	it('shows 07:00–21:00 when every entry fits', () => {
		expect(visibleHours([{ start: at(16, 9), end: at(16, 10) }])).toEqual({
			min: '07:00:00',
			max: '21:00:00'
		});
	});

	it('widens to entries before 07:00 and after 21:00', () => {
		expect(
			visibleHours([
				{ start: at(16, 6, 30), end: at(16, 7, 15) },
				{ start: at(17, 21, 30), end: at(17, 22, 15) }
			])
		).toEqual({ min: '06:00:00', max: '23:00:00' });
	});

	it('shows up to midnight for an entry that ends at midnight', () => {
		expect(
			visibleHours([{ start: at(16, 23), end: at(17, 0) }]).max
		).toBe('24:00:00');
	});

	it('shows the whole day for an entry over midnight', () => {
		expect(visibleHours([{ start: at(16, 22), end: at(17, 2) }])).toEqual({
			min: '00:00:00',
			max: '24:00:00'
		});
	});
});
