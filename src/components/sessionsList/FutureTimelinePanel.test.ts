import { describe, expect, it } from 'vitest';
import {
	normalizeTimelineLocale,
	toSeriesApiTimestamp
} from './futureTimelineTime';

describe('toSeriesApiTimestamp', () => {
	it('keeps the UTC offset required by the chat series API', () => {
		expect(toSeriesApiTimestamp(new Date('2026-07-20T16:00:00Z'))).toBe(
			'2026-07-20T16:00:00.000Z'
		);
	});

	it('normalizes app-specific and invalid locale variants', () => {
		expect(normalizeTimelineLocale(undefined, 'de@informal')).toBe('de');
		expect(normalizeTimelineLocale('not_a_locale_@@', undefined)).toBe(
			'en'
		);
	});
});
