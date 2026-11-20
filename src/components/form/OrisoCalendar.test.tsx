// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { OrisoCalendar } from './OrisoCalendar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de@informal' }
	})
}));

afterEach(cleanup);

describe('OrisoCalendar — names in the UI language (calendar test finding C8)', () => {
	it('labels days and the month in German', () => {
		const { container } = render(
			<OrisoCalendar value={dayjs(new Date(2026, 10, 25))} />
		);
		const labels = Array.from(
			container.querySelectorAll('[aria-label]')
		).map((el) => el.getAttribute('aria-label'));
		expect(labels).toContain('25. November 2026');
		expect(labels).not.toContain('25 November 2026');
		expect(
			container.querySelector('[role="grid"]')?.getAttribute('aria-label')
		).toBe('November 2026');
	});
});
