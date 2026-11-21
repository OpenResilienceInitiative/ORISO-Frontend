// @vitest-environment oriso-jsdom
/**
 * The appointment card's shortcuts: "Neuen Termin anlegen" after a
 * cancellation opens the room's own create dialog, only for whoever the room
 * lends it to; "Im Kalender öffnen" goes to that day in "Meine Termine".
 */
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	UserDataContext
} from '../../globalState';
import { lendAppointmentCreate } from '../sessionsList/timeline/appointmentCreateBridge';
import {
	AppointmentNoticeCard,
	AppointmentNoticeMessage
} from './AppointmentNoticeMessage';
import type { AppointmentNotice } from './appointmentNotice';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.name ? `${key}|${String(options.name)}` : key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

const SESSION = 4401;
const start = new Date(2026, 10, 18, 10, 0);
const end = new Date(2026, 10, 18, 11, 0);
const cancelled: AppointmentNotice = {
	kind: 'cancelled',
	slot: { start, end }
};
const booked: AppointmentNotice = { kind: 'created', slot: { start, end } };

const Location = () => {
	const { pathname, search } = useLocation();
	return <div data-testid="location">{`${pathname}${search}`}</div>;
};

const renderCard = (
	notice: AppointmentNotice,
	{
		viewer = 'consultant',
		readOnly = false
	}: { viewer?: 'consultant' | 'asker'; readOnly?: boolean } = {}
) =>
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: viewer,
							grantedAuthorities: [
								viewer === 'asker'
									? AUTHORITIES.ASKER_DEFAULT
									: AUTHORITIES.CONSULTANT_DEFAULT
							]
						}
					} as never
				}
			>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: {
								item: { id: SESSION },
								consultant: { id: 'c1' }
							}
						} as never
					}
				>
					<AppointmentNoticeCard
						notice={notice}
						sessionId={SESSION}
						byName="Bart Simpson"
						timestamp="12:00"
						readOnly={readOnly}
					/>
					<Location />
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

const createButton = () =>
	screen.queryByRole('button', {
		name: 'message.appointmentNotice.action.createNew'
	});
const calendarButton = () =>
	screen.queryByRole('button', {
		name: 'message.appointmentNotice.action.openCalendar'
	});

let giveBack: (() => void) | undefined;
afterEach(() => {
	giveBack?.();
	giveBack = undefined;
	cleanup();
});

describe('AppointmentNoticeCard — "Neuen Termin anlegen"', () => {
	it('opens the room’s create dialog after a cancellation', () => {
		const open = vi.fn();
		giveBack = lendAppointmentCreate(SESSION, { open, hasUpcoming: false });
		renderCard(cancelled);
		act(() => createButton()!.click());
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('appears when the room lends the dialog and goes when it takes it back', () => {
		renderCard(cancelled);
		expect(createButton()).toBeNull();
		act(() => {
			giveBack = lendAppointmentCreate(SESSION, {
				open: vi.fn(),
				hasUpcoming: false
			});
		});
		expect(createButton()).not.toBeNull();
		act(() => giveBack!());
		giveBack = undefined;
		expect(createButton()).toBeNull();
	});

	it('is not offered once a new appointment is booked', () => {
		giveBack = lendAppointmentCreate(SESSION, {
			open: vi.fn(),
			hasUpcoming: true
		});
		renderCard(cancelled);
		expect(createButton()).toBeNull();
	});

	it('is not offered for another conversation’s dialog', () => {
		giveBack = lendAppointmentCreate(SESSION + 1, {
			open: vi.fn(),
			hasUpcoming: false
		});
		renderCard(cancelled);
		expect(createButton()).toBeNull();
	});

	it('is not offered to the advice seeker', () => {
		// The room lends its dialog only to the conversation's counsellor.
		renderCard(cancelled, { viewer: 'asker' });
		expect(createButton()).toBeNull();
		expect(calendarButton()).toBeNull();
	});

	it('is not offered in a read-only preview', () => {
		giveBack = lendAppointmentCreate(SESSION, {
			open: vi.fn(),
			hasUpcoming: false
		});
		renderCard(cancelled, { readOnly: true });
		expect(createButton()).toBeNull();
	});
});

describe('AppointmentNoticeCard — "Im Kalender öffnen"', () => {
	it.each(['consultant', 'asker'] as const)(
		'takes the %s to the appointment’s day',
		(viewer) => {
			renderCard(booked, { viewer });
			act(() => calendarButton()!.click());
			expect(screen.getByTestId('location').textContent).toBe(
				'/booking/events?date=2026-11-18'
			);
		}
	);

	it('is not offered on a cancellation', () => {
		renderCard(cancelled);
		expect(calendarButton()).toBeNull();
	});
});

describe('AppointmentNoticeMessage', () => {
	it('shows a move as old (struck) → new', () => {
		const { container } = render(
			<AppointmentNoticeMessage
				locale="de-DE"
				notice={{
					kind: 'moved',
					slot: {
						start: new Date(2026, 10, 18, 13, 0),
						end: new Date(2026, 10, 18, 14, 0)
					},
					previous: { start, end }
				}}
			/>
		);
		const previous = screen.getByTestId('appointment-notice-previous');
		expect(previous.tagName).toBe('DEL');
		expect(previous.textContent).toContain('10:00–11:00');
		expect(
			screen.getByTestId('appointment-notice-slot').textContent
		).toContain('13:00–14:00');
		expect(
			container.querySelector('[data-cy="appointment-notice-moved"]')
		).not.toBeNull();
	});

	it('strikes through a cancelled slot, also from an old sentence', () => {
		render(
			<AppointmentNoticeMessage
				notice={{
					kind: 'cancelled',
					slotText: 'Mi 18. Nov 10:00–11:00'
				}}
			/>
		);
		const slot = screen.getByTestId('appointment-notice-slot');
		expect(slot.tagName).toBe('DEL');
		expect(slot.textContent).toBe('Mi 18. Nov 10:00–11:00');
	});

	it('names the event and who changed it', () => {
		render(
			<AppointmentNoticeMessage notice={booked} byName="Bart Simpson" />
		);
		expect(
			screen.getAllByText('message.appointmentNotice.title.created')
				.length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('message.appointmentNotice.by|Bart Simpson')
		).toBeTruthy();
		expect(
			screen.getByTestId('appointment-notice-icon-created')
		).toBeTruthy();
	});
});
