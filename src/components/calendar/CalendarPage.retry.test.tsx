// @vitest-environment oriso-jsdom
/**
 * A failed save keeps the appointment dialog with what was entered, and
 * saving again sends the same appointment (review 4575924424). The real
 * dialog; only the pickers are plain inputs and the grid is a stub.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { CalendarPage } from './CalendarPage';

dayjs.extend(customParseFormat);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('./CalendarView', () => ({
	CalendarView: () => <div data-testid="calendar-view" />
}));
type PickerProps = {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
};
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('HH:mm') : ''}
			onChange={(e) =>
				onChange?.(
					e.target.value ? dayjs(e.target.value, 'HH:mm') : null
				)
			}
		/>
	)
}));
vi.mock('../form/OrisoCalendar', () => ({
	OrisoCalendar: () => null
}));
vi.mock('../form/OrisoSelect', () => ({
	OrisoSelect: ({
		label,
		value,
		onChange
	}: {
		label: string;
		value: string;
		onChange: (event: { target: { value: string } }) => void;
	}) => (
		<input
			aria-label={label}
			value={value}
			onChange={(e) => onChange({ target: { value: e.target.value } })}
		/>
	)
}));

afterEach(cleanup);

const field = (name: string) => screen.getByLabelText<HTMLInputElement>(name);

describe('CalendarPage — saving an appointment again after a failure', () => {
	it('keeps the entered values when saving fails and saves the same appointment on retry', async () => {
		const onCreate = vi
			.fn()
			.mockRejectedValueOnce(new Error('500'))
			.mockResolvedValueOnce(undefined);
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={new Date(2026, 10, 16, 9)}
				entries={[]}
				conversations={[{ sessionId: 4402, username: 'mutige_eule' }]}
				onCreate={onCreate}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'calendar.header.newEntry' })
		);
		fireEvent.change(field('calendar.dialog.conversation'), {
			target: { value: '4402' }
		});
		fireEvent.change(
			field('sessionList.timeline.appointment.dialog.start'),
			{
				target: { value: '14:00' }
			}
		);
		fireEvent.change(field('sessionList.timeline.appointment.dialog.end'), {
			target: { value: '15:30' }
		});
		const save = () =>
			act(async () => {
				fireEvent.click(
					screen.getByRole('button', {
						name: 'sessionList.timeline.appointment.dialog.createAction'
					})
				);
			});

		await save();
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(screen.getByText('calendar.saveFailed')).toBeTruthy();
		// Still open, with everything entered.
		expect(field('calendar.dialog.conversation').value).toBe('4402');
		expect(
			field('sessionList.timeline.appointment.dialog.start').value
		).toBe('14:00');
		expect(field('sessionList.timeline.appointment.dialog.end').value).toBe(
			'15:30'
		);

		await save();
		expect(onCreate).toHaveBeenCalledTimes(2);
		expect(onCreate.mock.calls[1]).toEqual(onCreate.mock.calls[0]);
		expect(onCreate.mock.calls[1][0][0]).toMatchObject({
			type: 'appointment',
			kind: 'video',
			sessionId: 4402,
			start: new Date(2026, 10, 17, 14, 0),
			end: new Date(2026, 10, 17, 15, 30)
		});
		expect(
			screen.queryByRole('button', {
				name: 'sessionList.timeline.appointment.dialog.createAction'
			})
		).toBeNull();
	});
});
