// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALIAS_MESSAGE_TYPES } from '../../api/apiSendAliasMessage';
import { Appointment } from './Appointment';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const appointment = (overrides: Record<string, unknown> = {}) =>
	JSON.stringify({
		title: 'Consultation',
		user: 'User name',
		counselor: 'Counselor name',
		date: '2026-08-12T09:00:00.000Z',
		duration: 50,
		location: 'Video',
		...overrides
	});

const renderAppointment = (
	data: string,
	messageType: ALIAS_MESSAGE_TYPES = ALIAS_MESSAGE_TYPES.APPOINTMENT_SET
) => render(<Appointment data={data} messageType={messageType} />);

describe('Appointment', () => {
	it.each([
		['malformed JSON', '{'],
		['null JSON', 'null'],
		['array JSON', '[]'],
		['invalid date', appointment({ date: 'not-a-date' })],
		['zero duration', appointment({ duration: 0 })],
		['negative duration', appointment({ duration: -15 })],
		[
			'non-finite duration',
			appointment().replace('"duration":50', '"duration":1e400')
		],
		['overflowing duration', appointment({ duration: Number.MAX_VALUE })],
		['missing title', appointment({ title: undefined })],
		['blank calendar title', appointment({ title: '   ' })],
		['non-string location', appointment({ location: {} })],
		['non-string note', appointment({ note: {} })]
	])('renders no appointment card for %s', (_case, data) => {
		const { container } = renderAppointment(data);

		expect(container.childElementCount).toBe(0);
		expect(
			screen.queryByText('message.appointmentSet.addToCalendar')
		).toBeNull();
	});

	it('does not require unused user or counselor fields', () => {
		renderAppointment(
			appointment({ user: undefined, counselor: { legacy: true } })
		);

		expect(
			screen.getByText(
				'message.appointment.component.header.confirmation'
			)
		).toBeTruthy();
		expect(
			screen.getByText('message.appointmentSet.addToCalendar')
		).toBeTruthy();
	});

	it('renders no appointment card for an unsupported message type', () => {
		const { container } = renderAppointment(
			appointment(),
			'UNSUPPORTED_APPOINTMENT' as ALIAS_MESSAGE_TYPES
		);

		expect(container.childElementCount).toBe(0);
		expect(
			screen.queryByText(
				'message.appointment.component.header.cancellation'
			)
		).toBeNull();
	});

	it.each([
		[
			ALIAS_MESSAGE_TYPES.APPOINTMENT_SET,
			'message.appointment.component.header.confirmation',
			'message.appointmentSet.title',
			true
		],
		[
			ALIAS_MESSAGE_TYPES.APPOINTMENT_RESCHEDULED,
			'message.appointment.component.header.change',
			'message.appointmentRescheduled.title',
			true
		],
		[
			ALIAS_MESSAGE_TYPES.APPOINTMENT_CANCELLED,
			'message.appointment.component.header.cancellation',
			'message.appointmentCancelled.title',
			false
		],
		[
			ALIAS_MESSAGE_TYPES.INITIAL_APPOINTMENT_DEFINED,
			'message.appointment.component.header.confirmation',
			'message.appointmentSet.title',
			true
		]
	] as const)(
		'renders the explicit %s presentation',
		(messageType, header, title, hasCalendarAction) => {
			renderAppointment(appointment(), messageType);

			expect(screen.getByText(header)).toBeTruthy();
			expect(screen.getByText(title)).toBeTruthy();
			const calendarAction = screen.queryByText(
				'message.appointmentSet.addToCalendar'
			);
			expect(Boolean(calendarAction)).toBe(hasCalendarAction);
		}
	);
});
