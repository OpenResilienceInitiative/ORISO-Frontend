// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { Appointment } from './Appointment';

const calendarProps = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../downloadICSFile/downloadICSFile', () => ({
	DownloadICSFile: (props: unknown) => {
		calendarProps(props);
		return <button>calendar</button>;
	}
}));

afterEach(() => {
	cleanup();
	calendarProps.mockClear();
});

const renderAppointment = (date: string, duration: number) =>
	render(
		<Appointment
			data={JSON.stringify({
				title: 'Consultation',
				date,
				duration,
				location: 'Video'
			})}
			messageType={ALIAS_MESSAGE_TYPES.APPOINTMENT_SET}
		/>
	);

const displayedDateAndTime = (container: HTMLElement) => ({
	date: container.querySelector('.appointmentSet__date')?.textContent,
	time: container.querySelector('.appointmentSet__time')?.textContent
});

describe.skipIf(process.env.TZ !== 'Europe/Berlin')(
	'Appointment in Europe/Berlin',
	() => {
		it.each([
			['summer', '2026-08-12T09:00:00.000Z', 50, '11:00 - 11:50'],
			['winter', '2026-01-12T09:00:00.000Z', 50, '10:00 - 10:50'],
			[
				'spring DST transition',
				'2026-03-29T00:30:00.000Z',
				60,
				'01:30 - 03:30'
			],
			[
				'fall DST transition',
				'2026-10-25T00:30:00.000Z',
				120,
				'02:30 - 03:30'
			]
		])(
			'renders the real %s instants',
			(_case, date, duration, expected) => {
				const { container } = renderAppointment(date, duration);

				expect(displayedDateAndTime(container).time).toBe(expected);
				expect(calendarProps).toHaveBeenCalledWith(
					expect.objectContaining({
						start: date,
						durationMinutes: duration
					})
				);
			}
		);

		it('renders the local date after crossing midnight', () => {
			const date = '2026-08-12T23:30:00.000Z';
			const { container } = renderAppointment(date, 50);

			expect(displayedDateAndTime(container)).toEqual({
				date: 'Donnerstag, 13.08.26',
				time: '01:30 - 02:20'
			});
			expect(calendarProps).toHaveBeenCalledWith(
				expect.objectContaining({ start: date, durationMinutes: 50 })
			);
		});
	}
);

describe.skipIf(process.env.TZ !== 'UTC')('Appointment in UTC', () => {
	it('renders the raw instant without a Berlin-specific offset', () => {
		const date = '2026-08-12T09:00:00.000Z';
		const { container } = renderAppointment(date, 50);

		expect(displayedDateAndTime(container).time).toBe('09:00 - 09:50');
		expect(calendarProps).toHaveBeenCalledWith(
			expect.objectContaining({ start: date, durationMinutes: 50 })
		);
	});
});
