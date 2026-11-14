// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import {
	EdgeMenuContent,
	MonthDayMenuContent,
	MoveForm
} from './calendarMenus';

const i18n = vi.hoisted(() => ({ language: 'de' }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values ? `${key} ${JSON.stringify(values)}` : key,
		i18n
	})
}));

afterEach(() => {
	cleanup();
	i18n.language = 'de';
});

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

describe('menu dates in the app language (review 4574981864)', () => {
	// Monday 16 November 2026.
	const monday = new Date(2026, 10, 16);

	it('names the grip day in French on a French page', () => {
		i18n.language = 'fr';
		const { container } = render(
			<EdgeMenuContent
				edge="end"
				day={monday}
				from="17:00"
				to="18:00"
				remember={false}
				onRemember={() => undefined}
				onChoose={() => undefined}
			/>
		);
		expect(container.textContent).toContain('lundi 16 novembre 2026');
		expect(container.textContent).not.toMatch(/Montag|Monday/);
	});

	it('names the month day in Turkish on a Turkish page', () => {
		i18n.language = 'tr';
		const { container } = render(
			<MonthDayMenuContent
				start={monday}
				days={1}
				onAllDay={() => undefined}
				onWithTime={() => undefined}
				onAppointment={() => undefined}
			/>
		);
		expect(container.textContent).toContain('Kasım');
		expect(container.textContent).not.toMatch(/November/);
	});
});
