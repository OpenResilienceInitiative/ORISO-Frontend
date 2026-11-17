// @vitest-environment oriso-jsdom
/**
 * "Heute" ▾ jumps back as well as ahead: gestern, vor drei Tagen, vor
 * einer Woche, and übermorgen still lands on übermorgen (Frank,
 * 2026-11-17).
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { JumpMenuContent } from './calendarMenus';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const NOW = new Date(2026, 10, 16, 9, 50);
const day = (offset: number) => new Date(2026, 10, 16 + offset);

describe('JumpMenuContent — jumps into the past and ahead', () => {
	it('lists the past first, then today and the days ahead', () => {
		render(<JumpMenuContent now={NOW} onJump={vi.fn()} />);
		const keys = screen
			.getAllByRole('menuitem')
			.map((item) => item.dataset.cy?.replace('calendar-jump-', ''));
		expect(keys).toEqual([
			'weekAgo',
			'threeDaysAgo',
			'yesterday',
			'today',
			'tomorrow',
			'dayAfterTomorrow',
			'nextMonday',
			'inTwoWeeks'
		]);
	});

	it.each([
		['weekAgo', -7],
		['threeDaysAgo', -3],
		['yesterday', -1],
		['dayAfterTomorrow', 2]
	])('"%s" lands on that day', (key, offset) => {
		const onJump = vi.fn();
		render(<JumpMenuContent now={NOW} onJump={onJump} />);
		fireEvent.click(
			document.querySelector(`[data-cy="calendar-jump-${key}"]`)!
		);
		expect(onJump).toHaveBeenCalledWith(day(offset));
	});
});
