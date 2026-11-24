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
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import dayjs from 'dayjs';
import { AskerFreeTimesPanel } from './AskerFreeTimesPanel';
import { notifyAppointmentsChanged } from '../sessionsList/timeline/conversationAppointments';
import type {
	AppointmentSlot,
	SessionAppointment
} from '../../api/apiSessionAppointments';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

/** Tomorrow 10:00–11:00, bookable at once. */
const slot = (): AppointmentSlot => {
	const start = dayjs().add(1, 'day').hour(10).minute(0).second(0);
	return {
		startTime: start.millisecond(0).toISOString(),
		endTime: start.add(1, 'hour').millisecond(0).toISOString(),
		bookingMode: 'INSTANT'
	};
};

const panel = (
	slots: AppointmentSlot[],
	bookSlot = vi.fn(),
	onBooked = vi.fn()
) =>
	render(
		<AskerFreeTimesPanel
			sessionId={7}
			counsellorName="Laura Berger"
			loadSlots={() => Promise.resolve(slots)}
			bookSlot={bookSlot}
			onBooked={onBooked}
		/>
	);

describe('Freie Sprechzeiten (FE#2494 *2c)', () => {
	it('shows nothing while the counsellor offers no office hours', async () => {
		const { container } = panel([]);
		await waitFor(() => expect(container.innerHTML).toBe(''));
	});

	it('shows nothing when the free times cannot be read', async () => {
		const { container } = render(
			<AskerFreeTimesPanel
				sessionId={7}
				counsellorName="Laura Berger"
				loadSlots={() => Promise.reject(new Error('down'))}
				bookSlot={vi.fn()}
				onBooked={vi.fn()}
			/>
		);
		await waitFor(() => expect(container.innerHTML).toBe(''));
	});

	it('books a chosen time and says so', async () => {
		const free = slot();
		const booked = { status: 'CONFIRMED' } as SessionAppointment;
		const bookSlot = vi.fn().mockResolvedValue(booked);
		const onBooked = vi.fn();
		panel([free], bookSlot, onBooked);
		fireEvent.click(await screen.findByRole('button', { name: '10:00' }));
		fireEvent.click(screen.getByTestId('calendar-free-times-book'));
		await waitFor(() => expect(onBooked).toHaveBeenCalledWith(booked));
		expect(bookSlot).toHaveBeenCalledWith(7, {
			startTime: free.startTime,
			endTime: free.endTime,
			kind: 'VIDEO'
		});
		expect(
			screen.getByTestId('calendar-free-times-notice').textContent
		).toBe('videoCall.askerInfo.booking.booked');
	});

	it('shows and books none of the old times while the new medium loads', async () => {
		let phoneAnswer: (found: AppointmentSlot[]) => void = () => {};
		const loadSlots = vi.fn((_id: number, _from: Date, _to: Date, kind) =>
			kind === 'PHONE'
				? new Promise<AppointmentSlot[]>((resolve) => {
						phoneAnswer = resolve;
					})
				: Promise.resolve([slot()])
		);
		render(
			<AskerFreeTimesPanel
				sessionId={7}
				counsellorName="Laura Berger"
				loadSlots={loadSlots}
				bookSlot={vi.fn()}
				onBooked={vi.fn()}
			/>
		);
		fireEvent.click(await screen.findByRole('button', { name: '10:00' }));
		fireEvent.click(
			screen.getByRole('radio', {
				name: 'calendar.freeTimes.medium.phone'
			})
		);
		expect(screen.queryByRole('button', { name: '10:00' })).toBeNull();
		expect(
			screen.getByText('videoCall.askerInfo.booking.loading')
		).toBeTruthy();
		phoneAnswer([]);
		await waitFor(() =>
			expect(
				screen.getByText('videoCall.askerInfo.booking.none')
			).toBeTruthy()
		);
	});

	it('offers phone when video has no free times', async () => {
		const loadSlots = vi.fn((_id: number, _from: Date, _to: Date, kind) =>
			Promise.resolve(kind === 'PHONE' ? [slot()] : [])
		);
		render(
			<AskerFreeTimesPanel
				sessionId={7}
				counsellorName="Laura Berger"
				loadSlots={loadSlots}
				bookSlot={vi.fn()}
				onBooked={vi.fn()}
			/>
		);
		expect(
			await screen.findByRole('button', { name: '10:00' })
		).toBeTruthy();
		expect(
			screen
				.getByRole('radio', { name: 'calendar.freeTimes.medium.phone' })
				.getAttribute('aria-checked')
		).toBe('true');
	});

	it('reads the free times again when appointments change elsewhere', async () => {
		let found: AppointmentSlot[] = [];
		const loadSlots = vi.fn(() => Promise.resolve(found));
		const { container } = render(
			<AskerFreeTimesPanel
				sessionId={7}
				counsellorName="Laura Berger"
				loadSlots={loadSlots}
				bookSlot={vi.fn()}
				onBooked={vi.fn()}
			/>
		);
		await waitFor(() => expect(container.innerHTML).toBe(''));
		found = [slot()];
		act(() => notifyAppointmentsChanged());
		expect(
			await screen.findByRole('button', { name: '10:00' })
		).toBeTruthy();
	});

	it('changes between video and phone with the arrow keys', async () => {
		panel([slot()]);
		const video = await screen.findByRole('radio', {
			name: 'calendar.freeTimes.medium.video'
		});
		fireEvent.keyDown(video, { key: 'ArrowRight' });
		const phone = screen.getByRole('radio', {
			name: 'calendar.freeTimes.medium.phone'
		});
		expect(phone.getAttribute('aria-checked')).toBe('true');
		expect(document.activeElement).toBe(phone);
	});
});
