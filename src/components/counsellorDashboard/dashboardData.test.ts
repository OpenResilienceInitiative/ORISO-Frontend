import { describe, expect, it } from 'vite-plus/test';
import { last30Days, statisticsEnabled } from './dashboardData';

describe('statisticsEnabled', () => {
	it('follows the Träger setting; without a tenant it stays on', () => {
		expect(statisticsEnabled(null)).toBe(true);
		expect(
			statisticsEnabled({
				settings: { featureStatisticsEnabled: false }
			} as never)
		).toBe(false);
		expect(
			statisticsEnabled({
				settings: { featureStatisticsEnabled: true }
			} as never)
		).toBe(true);
	});
});

describe('last30Days', () => {
	it('counts in the local calendar, not in UTC', () => {
		const zone = process.env.TZ;
		process.env.TZ = 'Europe/Berlin';
		try {
			// 00:30 in Berlin is still the previous day in UTC.
			const today = new Date('2026-10-29T00:30:00+01:00');
			expect(last30Days(today)).toEqual({
				startDate: '2026-09-30',
				endDate: '2026-10-29'
			});
		} finally {
			process.env.TZ = zone;
		}
	});
});
