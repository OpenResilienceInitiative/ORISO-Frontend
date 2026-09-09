import { describe, expect, it } from 'vitest';
import { groupChatIntervalLabelKey } from './groupChatIntervalLabel';

describe('groupChatIntervalLabelKey', () => {
	it.each([
		['DAILY', 'groupChat.create.interval.options.daily'],
		['WEEKLY', 'groupChat.create.interval.options.weekly'],
		['BIWEEKLY', 'groupChat.create.interval.options.biweekly'],
		['MONTHLY', 'groupChat.create.interval.options.monthly'],
		['QUARTERLY', 'groupChat.create.interval.options.quarterly'],
		['YEARLY', 'groupChat.create.interval.options.yearly']
	] as const)('maps %s to its existing translation', (interval, expected) => {
		expect(groupChatIntervalLabelKey(interval)).toBe(expected);
	});
});
