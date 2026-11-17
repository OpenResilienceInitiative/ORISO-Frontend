// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AskerCallInfo } from './AskerCallInfoDialog';
import type { SessionAppointment } from '../../../api/apiSessionAppointments';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

afterEach(cleanup);

/* Two days ahead, so neither "today" nor the lead time is in the way. */
const start = dayjs().add(2, 'day').hour(10).minute(0).second(0).millisecond(0);
const free = {
	startTime: start.toDate().toISOString(),
	endTime: start.add(1, 'hour').toDate().toISOString()
};
const booked: SessionAppointment = {
	id: 'a-1',
	sessionId: 7,
	status: 'SCHEDULED',
	kind: 'VIDEO',
	...free
};

const conflict = (reason?: string) => () =>
	Promise.reject(
		new Response(null, {
			status: 409,
			headers: reason ? { 'X-Reason': reason } : {}
		})
	);

const openBooking = async (
	props: Partial<React.ComponentProps<typeof AskerCallInfo>>
) => {
	render(
		<AskerCallInfo
			sessionId={7}
			open
			onClose={vi.fn()}
			medium="VIDEO"
			load={() => Promise.resolve([])}
			{...props}
		/>
	);
	fireEvent.click(await screen.findByTestId('asker-call-info-request'));
};

const pickFirstTime = async () => {
	fireEvent.click(
		await screen.findByTestId(
			`appointment-booking-slot-${start.format('HH:mm')}`
		)
	);
};

describe('AskerCallInfo self-booking (FE#1050)', () => {
	it('tells the asker to pick a free time, not to write in the chat', async () => {
		render(
			<AskerCallInfo
				sessionId={7}
				open
				onClose={vi.fn()}
				medium="VIDEO"
				load={() => Promise.resolve([])}
			/>
		);
		expect(
			await screen.findByText('videoCall.askerInfo.requestHintBooking')
		).toBeTruthy();
		expect(
			screen.queryByText('videoCall.askerInfo.requestHint')
		).toBeNull();
	});

	it('opens the free times of the counsellor on "Termin anfragen"', async () => {
		const loadSlots = vi.fn().mockResolvedValue([free]);
		await openBooking({ loadSlots });

		expect(await screen.findByTestId('asker-self-booking')).toBeTruthy();
		expect(loadSlots).toHaveBeenCalledWith(
			7,
			expect.any(Date),
			expect.any(Date),
			'VIDEO'
		);
		// The first day with a free time is already open.
		expect(
			await screen.findByTestId(
				`appointment-booking-slot-${start.format('HH:mm')}`
			)
		).toBeTruthy();
	});

	it('books the chosen slot and then shows it as the next appointment', async () => {
		const bookSlot = vi.fn().mockResolvedValue(booked);
		const onBooked = vi.fn();
		await openBooking({
			loadSlots: vi.fn().mockResolvedValue([free]),
			bookSlot,
			onBooked
		});
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));

		await waitFor(() =>
			expect(bookSlot).toHaveBeenCalledWith(7, { ...free, kind: 'VIDEO' })
		);
		const card = await screen.findByTestId('asker-call-info-appointment');
		expect(card.textContent).toContain('videoCall.askerInfo.medium.video');
		expect(
			screen.getByText('videoCall.askerInfo.booking.booked')
		).toBeTruthy();
		expect(onBooked).toHaveBeenCalledWith(booked);
	});

	it('says when the counsellor has no free time and offers the chat', async () => {
		const onRequestTime = vi.fn();
		await openBooking({
			loadSlots: vi.fn().mockResolvedValue([]),
			onRequestTime
		});

		expect(
			await screen.findByText('videoCall.askerInfo.booking.none')
		).toBeTruthy();
		fireEvent.click(screen.getByTestId('asker-self-booking-chat'));
		expect(onRequestTime).toHaveBeenCalled();
	});

	it('says that the time was taken meanwhile and reads the free times again', async () => {
		const loadSlots = vi.fn().mockResolvedValue([free]);
		await openBooking({ loadSlots, bookSlot: conflict() });
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));

		expect(
			await screen.findByText('videoCall.askerInfo.booking.taken')
		).toBeTruthy();
		await waitFor(() => expect(loadSlots).toHaveBeenCalledTimes(2));
	});

	it('says that booking failed and keeps the choice', async () => {
		await openBooking({
			loadSlots: vi.fn().mockResolvedValue([free]),
			bookSlot: () => Promise.reject(new Error('boom'))
		});
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));

		expect(
			await screen.findByText('videoCall.askerInfo.booking.failed')
		).toBeTruthy();
		expect(
			screen
				.getByTestId(
					`appointment-booking-slot-${start.format('HH:mm')}`
				)
				.getAttribute('aria-pressed')
		).toBe('true');
	});

	it('shows the existing appointment when the conversation already has one', async () => {
		const load = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValue([booked]);
		await openBooking({
			load,
			loadSlots: vi.fn().mockResolvedValue([free]),
			bookSlot: conflict('SELF_BOOKING_LIMIT_REACHED')
		});
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));

		const card = await screen.findByTestId('asker-call-info-appointment');
		expect(card.textContent).toContain('videoCall.askerInfo.medium.video');
		expect(
			screen.getByText('videoCall.askerInfo.booking.limit')
		).toBeTruthy();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('says when the free times cannot be read', async () => {
		await openBooking({
			loadSlots: () => Promise.reject(new Error('down'))
		});

		expect(
			await screen.findByText('videoCall.askerInfo.booking.error')
		).toBeTruthy();
	});

	it('goes back to the information without booking', async () => {
		await openBooking({ loadSlots: vi.fn().mockResolvedValue([free]) });
		fireEvent.click(await screen.findByTestId('asker-self-booking-back'));

		expect(
			await screen.findByTestId('asker-call-info-request')
		).toBeTruthy();
	});
});
