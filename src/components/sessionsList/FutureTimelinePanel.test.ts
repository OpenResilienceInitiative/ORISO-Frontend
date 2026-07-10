import { describe, expect, it } from 'vitest';
import { toSeriesApiTimestamp } from './futureTimelineTime';

describe('toSeriesApiTimestamp', () => {
	it('keeps the UTC offset required by the chat series API', () => {
		expect(toSeriesApiTimestamp(new Date('2026-07-20T16:00:00Z'))).toBe(
			'2026-07-20T16:00:00.000Z'
		);
	});
});
