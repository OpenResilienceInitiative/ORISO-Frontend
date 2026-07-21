import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	formatChatMessageDateDivider,
	getChatMessageDateDivider
} from './dateHelpers';

describe('formatChatMessageDateDivider (#564)', () => {
	it('formats explicit dates as "7th of July 2026"', () => {
		expect(
			formatChatMessageDateDivider(new Date(2026, 6, 7).getTime())
		).toBe('7th of July 2026');
	});

	it('uses ordinal suffixes 1st / 2nd / 3rd / 4th', () => {
		expect(
			formatChatMessageDateDivider(new Date(2026, 0, 1).getTime())
		).toBe('1st of January 2026');
		expect(
			formatChatMessageDateDivider(new Date(2026, 2, 2).getTime())
		).toBe('2nd of March 2026');
		expect(
			formatChatMessageDateDivider(new Date(2026, 3, 3).getTime())
		).toBe('3rd of April 2026');
		expect(
			formatChatMessageDateDivider(new Date(2026, 4, 4).getTime())
		).toBe('4th of May 2026');
	});
});

describe('getChatMessageDateDivider (#564)', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps relative i18n keys for today', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 7, 12, 0, 0));
		const unixSeconds = Math.floor(
			new Date(2026, 6, 7, 9, 0, 0).getTime() / 1000
		);
		expect(getChatMessageDateDivider(unixSeconds)).toEqual({
			str: 'message.today',
			date: null
		});
	});

	it('formats only explicit (non-relative) dates', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
		const unixSeconds = Math.floor(
			new Date(2026, 6, 7, 9, 0, 0).getTime() / 1000
		);
		expect(getChatMessageDateDivider(unixSeconds)).toEqual({
			str: null,
			date: '7th of July 2026'
		});
	});
});
