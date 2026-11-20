import { describe, expect, it } from 'vite-plus/test';
import {
	formatScheduledAt,
	toLocalInputValue,
	toScheduledAt
} from './directLinkSchedule';

/* ORISO-Frontend#2142: the date and time a counsellor notes on a link.
   The input works in local time, the backend in UTC. */
describe('directLinkSchedule', () => {
	it('turns the local input value into an ISO time and back', () => {
		const iso = toScheduledAt('2026-11-20T14:30');
		expect(iso).toBe(new Date('2026-11-20T14:30').toISOString());
		expect(toLocalInputValue(iso)).toBe('2026-11-20T14:30');
	});

	it('treats an empty or broken input as no time', () => {
		expect(toScheduledAt('')).toBeUndefined();
		expect(toScheduledAt('morgen')).toBeUndefined();
		expect(toLocalInputValue(undefined)).toBe('');
		expect(toLocalInputValue('kaputt')).toBe('');
	});

	it('shows date and time in the given language', () => {
		const iso = new Date(2026, 10, 20, 14, 30).toISOString();
		const text = formatScheduledAt(iso, 'de');
		expect(text).toContain('20.11.2026');
		expect(text).toContain('14:30');
		expect(formatScheduledAt(undefined, 'de')).toBe('');
	});
});
