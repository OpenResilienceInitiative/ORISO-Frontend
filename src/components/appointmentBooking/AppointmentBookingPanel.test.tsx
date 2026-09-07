// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string | Record<string, unknown>) =>
			typeof fallback === 'string'
				? fallback
				: ((fallback?.defaultValue as string) ?? key)
	})
}));

const { AppointmentBookingPanel } = await import('./AppointmentBookingPanel');

/** The panel asks the platform before it animates; say "reduce" so the way
    back is synchronous and the assertion is about the callback, not a timer. */
const stubReducedMotion = (matches: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue({
			matches,
			media: '(prefers-reduced-motion: reduce)',
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		} as unknown as MediaQueryList)
	);

/** A working day in the month after this one — always inside the grid the
    calendar draws after one click on "next month", and never in the past. */
const nextMonthWorkday = () => {
	let day = dayjs().add(1, 'month').startOf('month');
	while (day.day() === 0 || day.day() === 6) {
		day = day.add(1, 'day');
	}
	return day;
};

const confirmButton = () =>
	screen.getByTestId('appointment-booking-confirm') as HTMLButtonElement;

describe('AppointmentBookingPanel', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('shows the calendar and asks for a day before any time', () => {
		stubReducedMotion(true);
		const { container } = render(
			<AppointmentBookingPanel onBack={vi.fn()} onConfirm={vi.fn()} />
		);

		expect(
			container.querySelector('[data-cy="appointment-booking-panel"]')
		).not.toBeNull();
		expect(
			screen.getByRole('grid', {
				name: dayjs().format('MMMM YYYY')
			})
		).toBeTruthy();
		expect(screen.getByTestId('appointment-booking-hint')).toBeTruthy();
		expect(confirmButton().disabled).toBe(true);
	});

	it('moves the shown month with the calendar arrows', () => {
		stubReducedMotion(true);
		render(
			<AppointmentBookingPanel onBack={vi.fn()} onConfirm={vi.fn()} />
		);

		fireEvent.click(screen.getByLabelText('Next month'));
		expect(
			screen.getByRole('grid', {
				name: dayjs().add(1, 'month').format('MMMM YYYY')
			})
		).toBeTruthy();

		fireEvent.click(screen.getByLabelText('Previous month'));
		expect(
			screen.getByRole('grid', { name: dayjs().format('MMMM YYYY') })
		).toBeTruthy();
	});

	it('hands over day and time as one ISO value once both are chosen', () => {
		stubReducedMotion(true);
		const onConfirm = vi.fn();
		render(
			<AppointmentBookingPanel onBack={vi.fn()} onConfirm={onConfirm} />
		);

		const day = nextMonthWorkday();
		fireEvent.click(screen.getByLabelText('Next month'));
		fireEvent.click(screen.getByLabelText(day.format('D MMMM YYYY')));

		/* A day alone is not a booking. */
		expect(confirmButton().disabled).toBe(true);

		fireEvent.click(screen.getByTestId('appointment-booking-slot-09:00'));
		expect(confirmButton().disabled).toBe(false);

		fireEvent.click(confirmButton());
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onConfirm.mock.calls[0][0]).toContain(
			`${day.format('YYYY-MM-DD')}T09:00`
		);
	});

	it('offers no times on a weekend', () => {
		stubReducedMotion(true);
		render(
			<AppointmentBookingPanel onBack={vi.fn()} onConfirm={vi.fn()} />
		);

		let saturday = dayjs().add(1, 'month').startOf('month');
		while (saturday.day() !== 6) {
			saturday = saturday.add(1, 'day');
		}
		fireEvent.click(screen.getByLabelText('Next month'));
		fireEvent.click(screen.getByLabelText(saturday.format('D MMMM YYYY')));

		expect(screen.getByTestId('appointment-booking-empty')).toBeTruthy();
	});

	it('goes back from the back button', () => {
		stubReducedMotion(true);
		const onBack = vi.fn();
		render(<AppointmentBookingPanel onBack={onBack} onConfirm={vi.fn()} />);

		fireEvent.click(screen.getByTestId('appointment-booking-back'));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('goes back on Escape', () => {
		stubReducedMotion(true);
		const onBack = vi.fn();
		render(<AppointmentBookingPanel onBack={onBack} onConfirm={vi.fn()} />);

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});
