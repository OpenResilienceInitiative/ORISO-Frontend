import { describe, expect, it } from 'vite-plus/test';
import {
	groupUpcomingByDay,
	invitationEntryPhase,
	invitationExpiresAt,
	waitingRoomOpensAt
} from './invitationModel';

const at = (hour: number, minute = 0) => new Date(2026, 10, 20, hour, minute);
const slot = { start: at(14), end: at(15) };

describe('Direkteinladung entry timing (#2252)', () => {
	it('opens the waiting room 15 minutes before the start', () => {
		expect(waitingRoomOpensAt(slot.start)).toEqual(at(13, 45));
	});

	it('expires at the end plus the validity', () => {
		expect(invitationExpiresAt(slot.end, 0)).toEqual(at(15));
		expect(invitationExpiresAt(slot.end, 90)).toEqual(at(16, 30));
	});

	it.each([
		['20 minutes before the start', at(13, 40), 'beforeStart'],
		['15 minutes before the start', at(13, 45), 'open'],
		['during the appointment', at(14, 30), 'open'],
		['after the end, still valid', at(15, 30), 'open'],
		['at the expiry', at(16), 'expired']
	] as const)('%s → %s', (_name, now, phase) => {
		expect(invitationEntryPhase(now, slot, at(16))).toBe(phase);
	});

	it('keeps an invitation without appointment open until it is deleted', () => {
		expect(invitationEntryPhase(at(3), null, null)).toBe('open');
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
});
