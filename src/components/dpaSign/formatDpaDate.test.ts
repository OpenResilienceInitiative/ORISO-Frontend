import { describe, expect, it } from 'vitest';
import { formatDpaDate } from './formatDpaDate';

describe('formatDpaDate', () => {
	it('shows the zoneless UTC version time in Berlin time', () => {
		expect(formatDpaDate('2026-09-25T07:55:00', 'de')).toContain('09:55');
	});

	it('leaves an explicit zone as it is', () => {
		expect(formatDpaDate('2026-09-25T07:55:00+02:00', 'de')).toContain(
			'07:55'
		);
	});

	it('shows a UTC confirmation across midnight in English Berlin time', () => {
		expect(formatDpaDate('2026-08-02T22:15:00', 'en')).toBe(
			'3 August 2026 at 00:15'
		);
	});

	it('preserves the original value when a display timestamp is invalid', () => {
		expect(formatDpaDate('invalid-date', 'de')).toBe('invalid-date');
	});
});
