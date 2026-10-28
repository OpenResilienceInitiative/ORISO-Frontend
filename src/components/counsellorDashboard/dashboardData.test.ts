import { describe, expect, it } from 'vite-plus/test';
import type { ListItemInterface } from '../../globalState/interfaces';
import { statisticsEnabled, upcomingCirclesFrom } from './dashboardData';

const now = new Date('2026-10-28T12:00:00Z');

const circle = (
	id: number,
	startDateWithTime: string,
	extra: Record<string, unknown> = {}
) =>
	({
		chat: {
			id,
			topic: `Kreis ${id}`,
			conversationType: 'SELF_HELP',
			startDateWithTime,
			duration: 60,
			modality: 'VIDEO',
			participants: [{}, {}],
			...extra
		}
	}) as unknown as ListItemInterface;

describe('upcomingCirclesFrom', () => {
	it('lists the next self-help circles, soonest first, at most three', () => {
		const result = upcomingCirclesFrom(
			[
				circle(1, '2026-10-30T18:00:00Z'),
				circle(2, '2026-10-29T18:00:00Z', { modality: 'TEXT' }),
				circle(3, '2026-11-02T18:00:00Z'),
				circle(4, '2026-11-05T18:00:00Z')
			],
			'de',
			now
		);
		expect(result.map((c) => c.id)).toEqual(['2', '1', '3']);
		expect(result[0]).toMatchObject({
			topic: 'Kreis 2',
			medium: 'CHAT',
			participants: 2
		});
		expect(result[1].medium).toBe('VIDEO');
		expect(result[1].when).toMatch(/Okt.* · \d{2}:\d{2}/);
	});

	it('keeps a running circle and drops past ones', () => {
		const result = upcomingCirclesFrom(
			[
				circle(1, '2026-10-28T11:30:00Z'),
				circle(2, '2026-10-27T18:00:00Z')
			],
			'de',
			now
		);
		expect(result.map((c) => c.id)).toEqual(['1']);
	});

	it('takes the next date of a series', () => {
		const result = upcomingCirclesFrom(
			[
				circle(1, '2026-10-21T18:00:00Z', {
					chatInterval: 'WEEKLY',
					repeatCount: 4,
					currentOccurrenceIndex: 0
				})
			],
			'de',
			now
		);
		expect(result).toHaveLength(1);
		// 21 Oct + one week = today 18:00, still ahead of 12:00.
		expect(result[0].when).toMatch(/28\. Okt/);
	});

	it('ignores conversations, internal groups and live chats', () => {
		const result = upcomingCirclesFrom(
			[
				{ session: { id: 5 } } as unknown as ListItemInterface,
				circle(6, '2026-10-30T18:00:00Z', {
					conversationType: 'INTERNAL_GROUP'
				})
			],
			'de',
			now
		);
		expect(result).toEqual([]);
	});
});

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
