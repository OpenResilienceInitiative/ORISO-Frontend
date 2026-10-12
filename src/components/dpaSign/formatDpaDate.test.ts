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
});
