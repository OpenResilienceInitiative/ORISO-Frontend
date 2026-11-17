import { describe, expect, it } from 'vite-plus/test';
import { shortTimeOf } from './calendarShortTime';

// Monday 16 November 2026, 09:50.
const now = new Date(2026, 10, 16, 9, 50);
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);

describe('shortTimeOf', () => {
	it('counts down within the hour', () => {
		expect(shortTimeOf(at(16, 10), now, at(16, 11))).toEqual({
			form: 'inMinutes',
			minutes: 10
		});
	});

	it('says "running" once it has started', () => {
		expect(shortTimeOf(at(16, 9, 30), now, at(16, 10, 30))).toEqual({
			form: 'running'
		});
	});

	it('names the clock time later today, tomorrow and on other days', () => {
		expect(shortTimeOf(at(16, 14), now, at(16, 15)).form).toBe('today');
		expect(shortTimeOf(at(17, 9), now, at(17, 10)).form).toBe('tomorrow');
		expect(shortTimeOf(at(19, 10), now, at(19, 11))).toEqual({
			form: 'weekday',
			at: at(19, 10)
		});
	});

	it('never counts down a free slot without an end', () => {
		expect(shortTimeOf(at(16, 10), now).form).toBe('today');
	});
});
