import { describe, expect, it } from 'vite-plus/test';
import { colleagueBands, foldsIntoBand } from './calendarBands';
import type { CalendarEntry } from './calendarModel';

const at = (hour: number, minute = 0) =>
	new Date(2026, 10, 16, hour, minute).toISOString();
const entry = (
	id: string,
	ownerId: string,
	from: [number, number?],
	to: [number, number?],
	extra: Partial<CalendarEntry> = {}
): CalendarEntry => ({
	id,
	type: 'appointment',
	kind: 'video',
	start: at(...from),
	end: at(...to),
	ownerId,
	...extra
});
const span = (band: { start: Date; end: Date }) => [
	band.start.getHours() * 60 + band.start.getMinutes(),
	band.end.getHours() * 60 + band.end.getMinutes()
];

describe('colleagueBands — colleagues fold into one band per stretch', () => {
	it('splits where the set of busy colleagues changes', () => {
		const bands = colleagueBands(
			[entry('k1', 'kaya', [9], [11]), entry('b1', 'berg', [10], [12])],
			['kaya', 'berg']
		);
		expect(bands.map(span)).toEqual([
			[540, 600],
			[600, 660],
			[660, 720]
		]);
		expect(bands.map((b) => b.busy)).toEqual([
			['kaya'],
			['kaya', 'berg'],
			['berg']
		]);
	});

	it('merges back-to-back entries of the same people and leaves gaps free', () => {
		const bands = colleagueBands(
			[
				entry('k1', 'kaya', [9], [10]),
				entry('k2', 'kaya', [10], [11]),
				entry('k3', 'kaya', [13], [14])
			],
			['kaya']
		);
		expect(bands.map(span)).toEqual([
			[540, 660],
			[780, 840]
		]);
	});

	it('leaves out own entries and colleagues not shown', () => {
		const bands = colleagueBands(
			[
				entry('own', 'me', [9], [10]),
				entry('other', 'kraus', [11], [12]),
				entry('k1', 'kaya', [14], [15])
			],
			['kaya']
		);
		expect(bands.map(span)).toEqual([[840, 900]]);
	});

	it('counts an all-day entry as busy the whole day, though it never folds (review 4576368849)', () => {
		const away = entry('day', 'berg', [0], [0], { allDay: true });
		const bands = colleagueBands(
			[away, entry('k1', 'kaya', [10], [12])],
			['kaya', 'berg']
		);
		expect(bands.map(span)).toEqual([
			[0, 600],
			[600, 720],
			[720, 0]
		]);
		expect(bands.map((b) => b.busy)).toEqual([
			['berg'],
			['kaya', 'berg'],
			['berg']
		]);
		expect(bands[2].end).toEqual(new Date(2026, 10, 17));
		// It stays in the all-day row.
		expect(foldsIntoBand(away, ['kaya', 'berg'])).toBe(false);
	});

	it('takes an all-day entry stored up to 23:59 as its whole last day', () => {
		const bands = colleagueBands(
			[entry('day', 'berg', [0], [23, 59], { allDay: true })],
			['berg']
		);
		expect(bands).toHaveLength(1);
		expect(bands[0].end).toEqual(new Date(2026, 10, 17));
	});

	it('folds only timed entries of the band people', () => {
		expect(foldsIntoBand(entry('k1', 'kaya', [9], [10]), ['kaya'])).toBe(
			true
		);
		expect(
			foldsIntoBand(entry('k2', 'kaya', [0], [0], { allDay: true }), [
				'kaya'
			])
		).toBe(false);
		expect(foldsIntoBand(entry('m', 'me', [9], [10]), ['kaya'])).toBe(
			false
		);
	});
});
