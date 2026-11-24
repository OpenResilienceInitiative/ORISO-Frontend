// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	ConsultationHoursDialog,
	useConsultationHoursForm
} from './ConsultationHoursDialog';
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

	it('holds every control while a save is on its way', () => {
		render(
			<ConsultationHoursDialog
				open
				saving
				hours={{
					...none,
					windows: [{ weekday: 2, start: '09:00', end: '12:00' }]
				}}
				onSave={vi.fn()}
				onClose={() => undefined}
			/>
		);
		const day = screen.getByTestId('consultation-hours-2');
		day.querySelectorAll('input').forEach((input) =>
			expect((input as HTMLInputElement).disabled).toBe(true)
		);
		expect(
			(
				screen.getByTestId(
					'consultation-hours-auto-accept'
				) as HTMLInputElement
			).disabled
		).toBe(true);
		expect(select('noticeDays').getAttribute('aria-disabled')).toBe('true');
		expect(select('slotMinutes').getAttribute('aria-disabled')).toBe(
			'true'
		);
	});

	it('refuses a day whose edited window runs into its second one', () => {
		const onSave = open({
			...none,
			windows: [
				{ weekday: 1, start: '09:00', end: '11:00' },
				{ weekday: 1, start: '14:00', end: '16:00' }
			]
		});
		const end = screen
			.getByTestId('consultation-hours-1')
			.querySelectorAll('input[type="time"]')[1] as HTMLInputElement;
		fireEvent.change(end, { target: { value: '15:00' } });

		expect(
			(screen.getByTestId('consultation-hours-save') as HTMLButtonElement)
				.disabled
		).toBe(true);
		expect(
			screen.getByText('calendar.consultationHours.overlaps')
		).toBeTruthy();
		fireEvent.click(screen.getByTestId('consultation-hours-save'));
		expect(onSave).not.toHaveBeenCalled();
	});

	it('adds a second window to a day with "+" and saves both (FE#2494 *2b)', () => {
		const onSave = open({
			...none,
			windows: [{ weekday: 2, start: '09:00', end: '12:00' }]
		});
		fireEvent.click(
			document.querySelector('[data-cy="consultation-add-2"]')!
		);
		expect(screen.getByTestId('consultation-window-2-1')).toBeTruthy();
		fireEvent.click(screen.getByTestId('consultation-hours-save'));
		expect(onSave.mock.calls[0][0].windows).toEqual([
			{ weekday: 2, start: '09:00', end: '12:00' },
			{ weekday: 2, start: '12:00', end: '14:00' }
		]);
	});

	it('removes a window and keeps the rest of the day', () => {
		const onSave = open({
			...none,
			windows: [
				{ weekday: 2, start: '09:00', end: '12:00' },
				{ weekday: 2, start: '16:00', end: '18:00' }
			]
		});
		fireEvent.click(
			document.querySelector('[data-cy="consultation-remove-2-0"]')!
		);
		fireEvent.click(screen.getByTestId('consultation-hours-save'));
		expect(onSave.mock.calls[0][0].windows).toEqual([
			{ weekday: 2, start: '16:00', end: '18:00' }
		]);
	});

	it('offers "Einmalig" only where a one-off can be saved', () => {
		open(none);
		expect(
			screen.queryByRole('radio', {
				name: 'calendar.consultationHours.modes.once'
			})
		).toBeNull();
	});

	it('takes saved hours that arrive after it opened, while untouched (FE#2494 review)', () => {
		const props = {
			open: true,
			onSave: vi.fn(),
			onClose: () => undefined
		};
		const { rerender } = render(
			<ConsultationHoursDialog {...props} hours={none} />
		);
		rerender(
			<ConsultationHoursDialog
				{...props}
				hours={{
					...none,
					windows: [{ weekday: 2, start: '09:00', end: '12:00' }]
				}}
			/>
		);
		fireEvent.click(screen.getByTestId('consultation-hours-save'));
		expect(props.onSave.mock.calls[0][0].windows).toEqual([
			{ weekday: 2, start: '09:00', end: '12:00' }
		]);
	});

	it('keeps an edited draft when the saved hours arrive later', () => {
		const props = {
			open: true,
			onSave: vi.fn(),
			onClose: () => undefined
		};
		const { rerender } = render(
			<ConsultationHoursDialog {...props} hours={none} />
		);
		fireEvent.click(
			screen
				.getByTestId('consultation-hours-4')
				.querySelector('input[type="checkbox"]')!
		);
		rerender(
			<ConsultationHoursDialog
				{...props}
				hours={{
					...none,
					windows: [{ weekday: 2, start: '09:00', end: '12:00' }]
				}}
			/>
		);
		fireEvent.click(screen.getByTestId('consultation-hours-save'));
		expect(
			props.onSave.mock.calls[0][0].windows.map(
				(w: { weekday: number }) => w.weekday
			)
		).toEqual([4]);
	});

	it('switches "Einmalig" and "Jede Woche" with the arrow keys', () => {
		const Form = () =>
			useConsultationHoursForm({
				hours: none,
				onSave: vi.fn(),
				onSaveOneOff: vi.fn(),
				onClose: () => undefined
			}).content as React.ReactElement;
		render(<Form />);
		const weekly = screen.getByRole('radio', {
			name: 'calendar.consultationHours.modes.weekly'
		});
		expect(weekly.getAttribute('aria-checked')).toBe('true');
		fireEvent.keyDown(weekly, { key: 'ArrowLeft' });
		const once = screen.getByRole('radio', {
			name: 'calendar.consultationHours.modes.once'
		});
		expect(once.getAttribute('aria-checked')).toBe('true');
		expect(document.activeElement).toBe(once);
	});
});
