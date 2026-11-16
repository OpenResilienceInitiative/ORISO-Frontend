// @vitest-environment oriso-jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { useDayLabels, useRangeFormat } from './useEntryLabel';

const i18n = vi.hoisted(() => ({ language: 'de' }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key, i18n })
}));

const format = (language: string) => {
	i18n.language = language;
	return renderHook(() => useRangeFormat()).result.current;
};

describe('useRangeFormat', () => {
	it('keeps the short form for a range within one day', () => {
		expect(
			format('de')(new Date(2026, 10, 16, 10), new Date(2026, 10, 16, 11))
		).toBe('Mo., 16.11., 10:00–11:00');
	});

	it('names the end date of a range over several days', () => {
		expect(
			format('de')(new Date(2026, 10, 16, 10), new Date(2026, 10, 18, 11))
		).toBe('Mo., 16.11., 10:00 – Mi., 18.11., 11:00');
	});

	it('treats an end at midnight as the end of the start day', () => {
		expect(
			format('de')(new Date(2026, 10, 16, 23), new Date(2026, 10, 17, 0))
		).toBe('Mo., 16.11., 23:00–00:00');
	});

	it('formats in the reader language, not German', () => {
		expect(
			format('fr')(new Date(2026, 10, 16, 10), new Date(2026, 10, 16, 11))
		).toBe('lun. 16/11, 10:00–11:00');
	});
});

describe('useDayLabels', () => {
	it('uses the reader language for the weekday initials', () => {
		i18n.language = 'ru';
		const { result } = renderHook(() => useDayLabels());
		// 15 November 2026 is a Sunday.
		expect(result.current[1]).toBe('П');
	});
});
