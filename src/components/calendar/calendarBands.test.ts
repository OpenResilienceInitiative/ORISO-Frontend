import { describe, expect, it } from 'vite-plus/test';
import {
	bandKey,
	colleagueBands,
	currentBand,
	entriesInBand,
	foldsIntoBand
} from './calendarBands';
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

describe('entriesInBand — what keeps each colleague of a band busy (Frank *16.2)', () => {
	const band = {
		start: new Date(2026, 10, 16, 11),
		end: new Date(2026, 10, 16, 12),
		busy: ['kaya', 'berg']
	};

	it('lists each busy person’s entries in the stretch, in band order, earliest first', () => {
		const people = entriesInBand(band, [
			entry('b1', 'berg', [11], [13]),
			entry('k2', 'kaya', [11, 30], [12]),
			entry('k1', 'kaya', [10], [11, 30]),
			// Ends where the band begins: not in it.
			entry('k0', 'kaya', [9], [11]),
			// Not busy in this band.
			entry('d1', 'demir', [11], [12])
		]);
		expect(
			people.map((p) => [p.personId, p.entries.map((e) => e.id)])
		).toEqual([
			['kaya', ['k1', 'k2']],
			['berg', ['b1']]
		]);
	});

	it('counts a whole-day entry, as the band does', () => {
		const people = entriesInBand(band, [
			entry('b1', 'berg', [11], [13]),
			entry('ba', 'berg', [0], [23, 59], { allDay: true }),
			entry('k1', 'kaya', [11], [12])
		]);
		expect(people[1].entries.map((e) => e.id)).toEqual(['ba', 'b1']);
	});
});

describe('currentBand — an open band card follows the bands on screen (review 4601827596, 4601827605)', () => {
	const people = ['kaya', 'nowak'];
	const kayaCopy = entry('k1', 'kaya', [10], [11]);
	const nowak = entry('n1', 'nowak', [10], [11]);
	const opened = colleagueBands([kayaCopy, nowak], people)[0];

	it('finds the band again by its stretch, with who is busy now', () => {
		// Kaya's copy moved to 14:00 while the card was open.
		const now = colleagueBands(
			[{ ...kayaCopy, start: at(14), end: at(15) }, nowak],
			people
		);
		const band = currentBand(bandKey(opened), now);
		expect(band?.busy).toEqual(['nowak']);
		expect(span(band!)).toEqual([600, 660]);
	});

	it('is gone when no band covers that stretch any more', () => {
		// Nowak's appointment was cancelled, Kaya hidden in the people bar.
		expect(currentBand(bandKey(opened), colleagueBands([nowak], []))).toBe(
			null
		);
		// Nowak hidden instead: the same stretch, Kaya alone.
		const kayaOnly = colleagueBands([kayaCopy, nowak], ['kaya']);
		expect(currentBand(bandKey(opened), kayaOnly)?.busy).toEqual(['kaya']);
	});
});
