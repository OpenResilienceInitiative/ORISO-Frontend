// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import { MoveForm } from './calendarMenus';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const entry = (start: Date, end: Date): CalendarEntry => ({
	id: 'a1',
	type: 'appointment',
	start: start.toISOString(),
	end: end.toISOString(),
	ownerId: 'me'
});

const move = (shown: CalendarEntry, date?: string) => {
	const onSubmit = vi.fn();
	const { container } = render(
		<MoveForm
			entry={shown}
			mode="move"
			entries={[]}
			ownerId="me"
			onSubmit={onSubmit}
			onBack={() => undefined}
		/>
	);
	if (date)
		fireEvent.change(
			container.querySelector('input[type="date"]') as HTMLInputElement,
			{ target: { value: date } }
		);
	fireEvent.submit(
		container.querySelector(
			'[data-cy="calendar-move-form"]'
		) as HTMLFormElement
	);
	return onSubmit;
};

describe('MoveForm — the end date (review 4574775688)', () => {
	it('keeps an entry over two days as it is when saved unchanged', () => {
		const start = new Date(2026, 10, 16, 10);
		const end = new Date(2026, 10, 17, 11);
		expect(move(entry(start, end))).toHaveBeenCalledWith(start, end);
	});

	it('moves an entry over midnight as a whole', () => {
		const onSubmit = move(
			entry(new Date(2026, 10, 16, 23), new Date(2026, 10, 17, 1)),
			'2026-11-20'
		);
		expect(onSubmit).toHaveBeenCalledWith(
			new Date(2026, 10, 20, 23),
			new Date(2026, 10, 21, 1)
		);
	});
});
