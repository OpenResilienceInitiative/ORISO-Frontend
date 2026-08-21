import { describe, expect, it } from 'vitest';
import { formatOpeningHours } from './openingHours';

const de = (key: string, fallback?: string) =>
	({
		'weekday.monday': 'Montag',
		'weekday.tuesday': 'Dienstag',
		'weekday.wednesday': 'Mittwoch'
	})[key] ??
	fallback ??
	key;

const payload = (slots: unknown) =>
	JSON.stringify({ version: 1, openingHours: slots });

describe('formatOpeningHours', () => {
	it('renders structured slots readable instead of raw JSON', () => {
		const value = payload([
			{
				fromDay: 'MONDAY',
				from: '10:00',
				untilDay: 'MONDAY',
				until: '11:00'
			},
			{
				fromDay: 'WEDNESDAY',
				from: '14:00',
				untilDay: 'WEDNESDAY',
				until: '16:00'
			}
		]);

		expect(formatOpeningHours(value, de)).toBe(
			'Montag 10:00–11:00 · Mittwoch 14:00–16:00'
		);
	});

	it('names the second weekday only when a slot crosses a day', () => {
		const value = payload([
			{
				fromDay: 'MONDAY',
				from: '22:00',
				untilDay: 'TUESDAY',
				until: '02:00'
			}
		]);

		expect(formatOpeningHours(value, de)).toBe(
			'Montag 22:00 – Dienstag 02:00'
		);
	});

	it('passes legacy free text through unchanged', () => {
		expect(formatOpeningHours('Mo-Fr 9-17 Uhr', de)).toBe('Mo-Fr 9-17 Uhr');
	});

	it('never leaks raw JSON when the payload is malformed', () => {
		expect(formatOpeningHours('{"openingHours": [broken', de)).toBe(
			'{"openingHours": [broken'
		);
		expect(formatOpeningHours(payload('not-a-list'), de)).toBe('');
	});

	it('skips unusable entries rather than rendering junk', () => {
		const value = payload([
			{
				fromDay: 'MONDAY',
				from: '10:00',
				untilDay: 'MONDAY',
				until: '11:00'
			},
			{
				fromDay: 'NOPE',
				from: '10:00',
				untilDay: 'MONDAY',
				until: '11:00'
			}
		]);

		expect(formatOpeningHours(value, de)).toBe('Montag 10:00–11:00');
	});

	it('returns an empty string for an empty or missing value', () => {
		expect(formatOpeningHours(undefined, de)).toBe('');
		expect(formatOpeningHours('   ', de)).toBe('');
	});
});
