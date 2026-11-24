import { describe, expect, it } from 'vite-plus/test';
import { gridMinutes } from './CalendarView';

describe('gridMinutes and own Sprechstunden (FE#2494 *3)', () => {
	it('widens the grid to weekly consultation windows', () => {
		expect(
			gridMinutes([], undefined, [], {
				windows: [{ weekday: 1, start: '06:00', end: '22:30' }]
			})
		).toEqual({ firstMinute: 6 * 60, lastMinute: 23 * 60 });
	});

	it('widens the grid to a one-off window', () => {
		const start = new Date(2026, 10, 25, 21, 0);
		const end = new Date(2026, 10, 25, 22, 0);
		expect(
			gridMinutes([], undefined, [], { once: [{ start, end }] })
		).toEqual({ firstMinute: 7 * 60, lastMinute: 22 * 60 });
	});

	it('keeps the usual day without consultation hours', () => {
		expect(gridMinutes([])).toEqual({
			firstMinute: 7 * 60,
			lastMinute: 21 * 60
		});
	});
});
