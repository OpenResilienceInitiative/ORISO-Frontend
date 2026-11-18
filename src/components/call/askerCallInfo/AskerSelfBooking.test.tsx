// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
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

	it('keeps a booking made after a conversation change when the older read of that conversation answers later', async () => {
		let answerRead: (items: SessionAppointment[]) => void = () => undefined;
		const load = vi.fn((sessionId: number) =>
			sessionId === 7
				? Promise.resolve([])
				: new Promise<SessionAppointment[]>((resolve) => {
						answerRead = resolve;
					})
		);
		const bookedInEight = { ...booked, sessionId: 8 };
		const props = {
			open: true,
			onClose: vi.fn(),
			medium: 'VIDEO' as const,
			load,
			loadSlots: vi.fn().mockResolvedValue([free]),
			bookSlot: vi.fn().mockResolvedValue(bookedInEight)
		};
		const { rerender } = render(<AskerCallInfo sessionId={7} {...props} />);
		fireEvent.click(await screen.findByTestId('asker-call-info-request'));
		rerender(<AskerCallInfo sessionId={8} {...props} />);
		await waitFor(() => expect(load).toHaveBeenLastCalledWith(8));
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));
		await screen.findByTestId('asker-call-info-appointment');

		await act(async () => answerRead([]));

		expect(screen.getByTestId('asker-call-info-appointment')).toBeTruthy();
		expect(
			screen.getByText('videoCall.askerInfo.booking.booked')
		).toBeTruthy();
	});

	it('forgets the chosen time when the conversation changes', async () => {
		const loadSlots = vi.fn().mockResolvedValue([free]);
		const bookSlot = vi.fn().mockResolvedValue(booked);
		const props = {
			open: true,
			onClose: vi.fn(),
			medium: 'VIDEO' as const,
			load: () => Promise.resolve([]),
			loadSlots,
			bookSlot
		};
		const { rerender } = render(<AskerCallInfo sessionId={7} {...props} />);
		fireEvent.click(await screen.findByTestId('asker-call-info-request'));
		await pickFirstTime();

		rerender(<AskerCallInfo sessionId={8} {...props} />);
		await waitFor(() =>
			expect(loadSlots).toHaveBeenLastCalledWith(
				8,
				expect.any(Date),
				expect.any(Date),
				'VIDEO'
			)
		);
		await screen.findByTestId(
			`appointment-booking-slot-${start.format('HH:mm')}`
		);
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));

		expect(bookSlot).not.toHaveBeenCalled();
	});

	it('reports a booking that finishes after the conversation changed to the conversation it was made in, without showing it in the new one', async () => {
		let finish: (value: SessionAppointment) => void = () => undefined;
		const bookSlot = vi.fn(
			() =>
				new Promise<SessionAppointment>((resolve) => {
					finish = resolve;
				})
		);
		const onBooked = vi.fn();
		const props = {
			open: true,
			onClose: vi.fn(),
			medium: 'VIDEO' as const,
			load: () => Promise.resolve([]),
			loadSlots: vi.fn().mockResolvedValue([free]),
			bookSlot,
			onBooked
		};
		const { rerender } = render(<AskerCallInfo sessionId={7} {...props} />);
		fireEvent.click(await screen.findByTestId('asker-call-info-request'));
		await pickFirstTime();
		fireEvent.click(screen.getByTestId('asker-self-booking-confirm'));
		await waitFor(() => expect(bookSlot).toHaveBeenCalled());

		const onBookedInEight = vi.fn();
		rerender(
			<AskerCallInfo
				sessionId={8}
				{...props}
				onBooked={onBookedInEight}
			/>
		);
		await act(async () => finish(booked));

		// The server made the appointment: the counsellor's notice and the
		// appointment list still learn of it, in the conversation it was made in.
		expect(onBooked).toHaveBeenCalledOnce();
		expect(onBooked).toHaveBeenCalledWith(booked);
		expect(onBookedInEight).not.toHaveBeenCalled();
		expect(screen.queryByTestId('asker-call-info-appointment')).toBeNull();
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

	describe('Sprechstunden: instant times and requests (FE#2287)', () => {
		const later = start.add(1, 'hour');
		const instant = { ...free, bookingMode: 'INSTANT' as const };
		const request = {
			startTime: later.toDate().toISOString(),
			endTime: later.add(1, 'hour').toDate().toISOString(),
			bookingMode: 'REQUEST' as const
		};
		const requested: SessionAppointment = {
			id: 'a-2',
			sessionId: 7,
			status: 'REQUESTED',
			kind: 'VIDEO',
			startTime: request.startTime,
			endTime: request.endTime
		};

		it('marks the request times and explains them', async () => {
			await openBooking({
				loadSlots: vi.fn().mockResolvedValue([instant, request])
			});

			const asked = await screen.findByTestId(
				`appointment-booking-slot-${later.format('HH:mm')}`
			);
			expect(asked.getAttribute('data-booking-mode')).toBe('REQUEST');
			expect(
				screen
					.getByTestId(
						`appointment-booking-slot-${start.format('HH:mm')}`
					)
					.getAttribute('data-booking-mode')
			).toBe('INSTANT');
			expect(
				screen
					.getByTestId('appointment-booking-legend')
					.querySelector('[data-booking-mode="REQUEST"]')
			).toBeTruthy();
		});

		it('asks for a request time and shows it as waiting for confirmation', async () => {
			const bookSlot = vi.fn().mockResolvedValue(requested);
			const onBooked = vi.fn();
			await openBooking({
				loadSlots: vi.fn().mockResolvedValue([instant, request]),
				bookSlot,
				onBooked
			});
			fireEvent.click(
				await screen.findByTestId(
					`appointment-booking-slot-${later.format('HH:mm')}`
				)
			);
			const confirm = screen.getByTestId('asker-self-booking-confirm');
			expect(confirm.textContent).toBe(
				'videoCall.askerInfo.booking.confirmRequest'
			);
			fireEvent.click(confirm);

			await waitFor(() =>
				expect(bookSlot).toHaveBeenCalledWith(7, {
					startTime: request.startTime,
					endTime: request.endTime,
					kind: 'VIDEO'
				})
			);
			const card = await screen.findByTestId(
				'asker-call-info-appointment'
			);
			// Same words as the split button below the header, no own chip.
			expect(
				card.querySelector('.askerCallInfo__slot')?.textContent
			).toMatch(
				/^sessionList\.timeline\.appointment\.request\.marker · /
			);
			expect(
				screen.queryByTestId('asker-call-info-requested')
			).toBeNull();
			expect(
				screen.getByText('videoCall.askerInfo.booking.requested')
			).toBeTruthy();
			expect(onBooked).toHaveBeenCalledWith(requested);
		});

		it('books an instant time with "Termin buchen"', async () => {
			await openBooking({
				loadSlots: vi.fn().mockResolvedValue([instant, request])
			});
			await pickFirstTime();

			expect(
				screen.getByTestId('asker-self-booking-confirm').textContent
			).toBe('videoCall.askerInfo.booking.confirm');
		});

		it('gives a temporary asker no chat hint when there is no free time', async () => {
			await openBooking({
				loadSlots: vi.fn().mockResolvedValue([]),
				onRequestTime: undefined
			});

			expect(
				await screen.findByText('videoCall.askerInfo.booking.none')
			).toBeTruthy();
			expect(
				screen.queryByText('videoCall.askerInfo.requestHint')
			).toBeNull();
			expect(screen.queryByTestId('asker-self-booking-chat')).toBeNull();
		});

		it('gives a registered asker the hint to write in the chat', async () => {
			await openBooking({
				loadSlots: vi.fn().mockResolvedValue([]),
				onRequestTime: vi.fn()
			});

			expect(
				await screen.findByText('videoCall.askerInfo.requestHint')
			).toBeTruthy();
		});
	});
});
