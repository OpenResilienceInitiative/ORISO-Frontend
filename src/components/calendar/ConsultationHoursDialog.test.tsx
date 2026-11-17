// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ConsultationHoursDialog } from './ConsultationHoursDialog';
import type { ConsultationHours } from './calendarConsultationHours';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count === undefined ? key : `${key}:${options.count}`,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

/* Both settings are the design system's select, like "Bundesland" in the
   working hours (Frank *12), not own fields. */
const select = (label: string) =>
	screen.getByRole('combobox', {
		name: `calendar.consultationHours.${label}`
	});
const choose = (label: string, option: string) => {
	fireEvent.mouseDown(select(label));
	fireEvent.click(screen.getByRole('option', { name: option }));
};

const none: ConsultationHours = {
	windows: [],
	autoAccept: true,
	noticeDays: 1,
	slotMinutes: 60
};

const open = (hours: ConsultationHours, onSave = vi.fn()) => {
	render(
		<ConsultationHoursDialog
			open
			hours={hours}
			onSave={onSave}
			onClose={() => undefined}
		/>
	);
	return onSave;
};

describe('ConsultationHoursDialog (FE#2287)', () => {
	it('saves a switched-on day with the settings', () => {
		const onSave = open(none);
		fireEvent.click(
			screen
				.getByTestId('consultation-hours-2')
				.querySelector('input[type="checkbox"]')!
		);
		fireEvent.click(screen.getByTestId('consultation-hours-auto-accept'));
		choose('noticeDays', 'calendar.consultationHours.noticeDaysOption:3');
		choose('slotMinutes', 'calendar.consultationHours.minutes:30');
		fireEvent.click(screen.getByTestId('consultation-hours-save'));

		expect(onSave).toHaveBeenCalledWith({
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }],
			autoAccept: false,
			noticeDays: 3,
			slotMinutes: 30
		});
	});

	it('shows the stored days and settings', () => {
		open({
			windows: [{ weekday: 5, start: '13:00', end: '15:00' }],
			autoAccept: false,
			noticeDays: 2,
			slotMinutes: 30
		});
		const friday = screen.getByTestId('consultation-hours-5');
		expect(
			(friday.querySelector('input[type="checkbox"]') as HTMLInputElement)
				.checked
		).toBe(true);
		expect(select('noticeDays').textContent).toBe(
			'calendar.consultationHours.noticeDaysOption:2'
		);
		expect(select('slotMinutes').textContent).toBe(
			'calendar.consultationHours.minutes:30'
		);
	});

	it('refuses an end before the start', () => {
		const onSave = open({
			...none,
			windows: [{ weekday: 1, start: '09:00', end: '10:00' }]
		});
		const monday = screen.getByTestId('consultation-hours-1');
		fireEvent.change(monday.querySelectorAll('input[type="time"]')[1], {
			target: { value: '08:00' }
		});
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.consultationHours.invalid'
		);
		const save = screen.getByTestId('consultation-hours-save');
		expect((save as HTMLButtonElement).disabled).toBe(true);

		fireEvent.click(save);
		expect(onSave).not.toHaveBeenCalled();
	});

	it('offers notice days from 0 to 30 only', () => {
		open(none);
		fireEvent.mouseDown(select('noticeDays'));
		const options = screen.getAllByRole('option');
		expect(options).toHaveLength(31);
		expect(options[30].textContent).toBe(
			'calendar.consultationHours.noticeDaysOption:30'
		);
	});

	it('says that without Sprechstunden nobody can book', () => {
		open(none);
		expect(screen.getByTestId('consultation-hours-empty').textContent).toBe(
			'calendar.consultationHours.empty'
		);
	});
});
