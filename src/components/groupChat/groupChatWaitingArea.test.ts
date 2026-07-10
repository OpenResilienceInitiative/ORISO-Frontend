import { describe, expect, it } from 'vitest';
import { getWaitingAreaTime } from './groupChatWaitingArea';

describe('getWaitingAreaTime', () => {
	it('keeps counting negatively after the planned start', () => {
		const result = getWaitingAreaTime(
			new Date('2026-08-04T18:07:00Z'),
			new Date('2026-08-04T18:00:00Z')
		);

		expect(result.signedMinutes).toBe(-7);
		expect(result.label).toBe('-00:07');
		expect(result.discomfortEmoji).toBe('😬');
		expect(result.pills).toEqual([
			{ kind: 'dog', value: 49 },
			{ kind: 'cat', value: 32 },
			{ kind: 'roman', value: 'VII' }
		]);
	});
});
