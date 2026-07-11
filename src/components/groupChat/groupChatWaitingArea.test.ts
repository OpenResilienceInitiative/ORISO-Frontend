import { describe, expect, it } from 'vitest';
import { getWaitingAreaTime } from './groupChatWaitingArea';

describe('getWaitingAreaTime', () => {
	it.each([
		['before', '2026-08-04T17:59:30Z', 1, '00:01'],
		['after', '2026-08-04T18:00:30Z', -1, '-00:01'],
		['exactly at', '2026-08-04T18:00:00Z', 0, '00:00']
	])(
		'rounds sign-aware %s the planned start',
		(_label, now, signedMinutes, display) => {
			const result = getWaitingAreaTime(
				new Date(now),
				new Date('2026-08-04T18:00:00Z')
			);

			expect(result.signedMinutes).toBe(signedMinutes);
			expect(result.label).toBe(display);
		}
	);

	it('keeps counting negatively after the planned start', () => {
		const result = getWaitingAreaTime(
			new Date('2026-08-04T18:07:00Z'),
			new Date('2026-08-04T18:00:00Z')
		);

		expect(result.signedMinutes).toBe(-7);
		expect(result.label).toBe('-00:07');
		expect(result.discomfortEmoji).toBe('😬');
		expect(result.discomfortLabel).toBe('late');
		expect(result.pills).toEqual([
			{ kind: 'dog', value: 49 },
			{ kind: 'cat', value: 32 },
			{ kind: 'roman', value: 'VII' }
		]);
	});

	it('does not truncate Roman waiting time values above 399 minutes', () => {
		const result = getWaitingAreaTime(
			new Date('2026-08-04T11:20:00Z'),
			new Date('2026-08-04T18:00:00Z')
		);

		expect(result.signedMinutes).toBe(400);
		expect(result.pills[2]).toEqual({ kind: 'roman', value: 'CD' });
	});

	it.each([
		['2026-08-04T18:04:01Z', -5, 'slightlyLate', '😅'],
		['2026-08-04T18:14:01Z', -15, 'late', '😬']
	] as const)(
		'classifies raw time before applying display rounding',
		(now, signedMinutes, discomfortLabel, discomfortEmoji) => {
			const result = getWaitingAreaTime(
				new Date(now),
				new Date('2026-08-04T18:00:00Z')
			);
			expect(result.signedMinutes).toBe(signedMinutes);
			expect(result.discomfortLabel).toBe(discomfortLabel);
			expect(result.discomfortEmoji).toBe(discomfortEmoji);
		}
	);
});
