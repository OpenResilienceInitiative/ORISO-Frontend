import { describe, expect, it } from 'vite-plus/test';
import {
	groupUpcomingByDay,
	invitationEntryPhase,
	MAX_TIMER_MS,
	timerDelay
} from './invitationModel';

const at = (hour: number, minute = 0) => new Date(2026, 10, 20, hour, minute);

describe('Direkteinladung entry timing (#2252)', () => {
	/* The server's own times: the waiting room opens at callOpensAt. */
	const times = { callOpensAt: at(13, 45), expiresAt: at(16) };

	it.each([
		['20 minutes before the start', at(13, 40), 'beforeStart'],
		['when the waiting room opens', at(13, 45), 'open'],
		['during the appointment', at(14, 30), 'open'],
		['after the end, still valid', at(15, 30), 'open'],
		['at the expiry', at(16), 'expired']
	] as const)('%s → %s', (_name, now, phase) => {
		expect(invitationEntryPhase(now, times)).toBe(phase);
	});

	it('keeps an invitation without appointment open until it is deleted', () => {
		expect(invitationEntryPhase(at(3), {})).toBe('open');
	});

	it('reads ISO strings as the server sends them', () => {
		expect(
			invitationEntryPhase(at(13), {
				callOpensAt: at(13, 45).toISOString(),
				expiresAt: null
			})
		).toBe('beforeStart');
	});

	it('ignores a time it cannot read', () => {
		expect(invitationEntryPhase(at(13), { callOpensAt: 'nonsense' })).toBe(
			'open'
		);
	});
});

describe('a timer for a far-away time (#2252)', () => {
	it('waits the time left', () => {
		expect(timerDelay(at(14), at(13, 59))).toBe(60_000);
	});

	it('never waits a negative time', () => {
		expect(timerDelay(at(13), at(14))).toBe(0);
	});

	/* setTimeout fires at once above 2^31-1 ms (about 24.8 days). */
	it('caps the wait so an appointment months ahead does not fire at once', () => {
		const now = new Date(2026, 0, 1);
		const far = new Date(2026, 5, 1);
		expect(timerDelay(far, now)).toBe(MAX_TIMER_MS);
		expect(MAX_TIMER_MS).toBe(2 ** 31 - 1);
	});
});

describe('upcoming appointments by day (#2252 overview)', () => {
	const item = (id: string, day: number, hour: number) => ({
		id,
		start: new Date(2026, 10, day, hour),
		end: new Date(2026, 10, day, hour + 1)
	});
	const now = new Date(2026, 10, 20, 12, 0);

	it('drops finished ones, sorts and groups them as today, tomorrow, later', () => {
		const groups = groupUpcomingByDay(
			[
				item('later', 25, 9),
				item('past', 20, 8),
				item('tomorrow', 21, 9),
				item('now', 20, 12),
				item('today', 20, 16)
			],
			now
		);
		expect(
			groups.map((g) => [g.relative, g.items.map((i) => i.id)])
		).toEqual([
			['today', ['now', 'today']],
			['tomorrow', ['tomorrow']],
			[null, ['later']]
		]);
		expect(groups[2].day).toEqual(new Date(2026, 10, 25));
	});

	it('keeps an ended invitation while its link still works', () => {
		const ended = {
			...item('ended', 20, 9),
			expiresAt: new Date(2026, 10, 21, 10)
		};
		const gone = {
			...item('gone', 20, 8),
			expiresAt: new Date(2026, 10, 20, 11)
		};
		const groups = groupUpcomingByDay([ended, gone], now);
		expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
			['ended']
		]);
	});

	it('keeps the start date heading for one that began yesterday and still runs', () => {
		const overnight = {
			id: 'overnight',
			start: new Date(2026, 10, 19, 23, 30),
			end: new Date(2026, 10, 20, 1, 0)
		};
		const groups = groupUpcomingByDay(
			[overnight],
			new Date(2026, 10, 20, 0, 30)
		);
		expect(groups.map((g) => [g.relative, g.day])).toEqual([
			[null, new Date(2026, 10, 19)]
		]);
	});
});
