import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	formatChatMessageDateDivider,
	formatToHHMM,
	getChatMessageDateDivider
} from './dateHelpers';

describe('formatToHHMM', () => {
	it('keeps the chat time in HH:MM form before 10:00', () => {
		expect(formatToHHMM(String(new Date(2026, 0, 1, 9, 5).getTime()))).toBe(
			'09:05'
		);
	});
});

describe('formatChatMessageDateDivider (#564)', () => {
	it('formats explicit dates in the active locale (de)', () => {
		expect(
			formatChatMessageDateDivider(new Date(2026, 6, 7).getTime(), 'de')
		).toBe('7. Juli 2026');
	});

	it('localizes the month name per locale', () => {
		const ms = new Date(2026, 6, 7).getTime();
		expect(formatChatMessageDateDivider(ms, 'de')).toBe('7. Juli 2026');
		expect(formatChatMessageDateDivider(ms, 'en')).toBe('July 7, 2026');
		expect(formatChatMessageDateDivider(ms, 'fr')).toBe('7 juillet 2026');
	});

	it('formats various months (de)', () => {
		expect(
			formatChatMessageDateDivider(new Date(2026, 0, 1).getTime(), 'de')
		).toBe('1. Januar 2026');
		expect(
			formatChatMessageDateDivider(new Date(2026, 2, 2).getTime(), 'de')
		).toBe('2. März 2026');
		expect(
			formatChatMessageDateDivider(new Date(2026, 4, 4).getTime(), 'de')
		).toBe('4. Mai 2026');
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
		expect(getChatMessageDateDivider(unixSeconds, 'de')).toEqual({
			str: null,
			date: '7. Juli 2026'
		});
	});
});
