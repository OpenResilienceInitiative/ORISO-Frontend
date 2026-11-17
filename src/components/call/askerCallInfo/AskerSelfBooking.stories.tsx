import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import dayjs from 'dayjs';
import { AskerCallInfo } from './AskerCallInfoDialog';
import type {
	AppointmentSlot,
	SessionAppointment
} from '../../../api/apiSessionAppointments';

/* Free times relative to today, two to six days ahead, like the server
   offers them from the Sprechstunden: one hour long on the half hour,
   outside the lead time. The first morning lies inside the counsellor's
   notice days, so its times are requests (FE#2287); the rest are booked
   at once. */
const firstDay = dayjs().add(2, 'day').startOf('day');
const slots: AppointmentSlot[] = [0, 1, 3, 4].flatMap((offset) =>
	['09:00', '09:30', '10:00', '13:30', '14:00', '15:30'].map((time) => {
		const [hour, minute] = time.split(':').map(Number);
		const start = firstDay.add(offset, 'day').hour(hour).minute(minute);
		return {
			startTime: start.toDate().toISOString(),
			endTime: start.add(1, 'hour').toDate().toISOString(),
			bookingMode:
				offset === 0 && hour < 12
					? ('REQUEST' as const)
					: ('INSTANT' as const)
		};
	})
);
const chosen = slots[3];
const requestSlot = slots[2];
const booked: SessionAppointment = {
	id: 'story-appointment',
	sessionId: 7,
	status: 'SCHEDULED',
	kind: 'VIDEO',
	...chosen
};

const noAppointments = () => Promise.resolve([] as SessionAppointment[]);
const freeTimes = () => Promise.resolve(slots);
const timeLabel = dayjs(chosen.startTime).format('HH:mm');
const requestLabel = dayjs(requestSlot.startTime).format('HH:mm');
const requested: SessionAppointment = {
	...booked,
	id: 'story-request',
	status: 'REQUESTED',
	startTime: requestSlot.startTime,
	endTime: requestSlot.endTime
};

const openBooking = async () => {
	const view = within(document.body);
	await userEvent.click(await view.findByTestId('asker-call-info-request'));
	return view;
};

const meta = {
	title: 'Chat/Calls/Advice seeker self-booking',
	component: AskerCallInfo,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'FE#1050 and FE#2287, product owner 17 Nov 2026: an advice seeker without an appointment clicks the video or audio button of a 1:1 conversation, then "Termin anfragen", and picks a free time of the counsellor. The free times come from the UserService: the counsellor\'s Sprechstunden minus appointments, open requests, group dates, blockers, imported busy times and holidays, at most 14 days ahead, in the counsellor\'s slot length. A time outside the notice days of a counsellor with "automatisch bestätigen" is booked at once; any other time is a request (dashed, hourglass) that the counsellor confirms or declines. Without Sprechstunden there is no free time; registered advice seekers are pointed to the chat, temporary ones are not. Video or phone is what the asker clicked.'
			}
		}
	},
	args: {
		sessionId: 7,
		open: true,
		medium: 'VIDEO',
		onClose: fn(),
		onRequestTime: fn(),
		onBooked: fn(),
		load: noAppointments,
		loadSlots: freeTimes,
		bookSlot: () => Promise.resolve(booked)
	},
	render: (args) => (
		<div style={{ minHeight: 760 }}>
			<AskerCallInfo {...args} />
		</div>
	)
} satisfies Meta<typeof AskerCallInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Information: Story = {
	name: 'Information before booking',
	play: async () => {
		const view = within(document.body);
		await expect(
			await view.findByTestId('asker-call-info-request')
		).toBeInTheDocument();
	}
};

export const SlotsAvailable: Story = {
	name: 'Free times available',
	play: async () => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		);
		await expect(
			view.getByTestId('asker-self-booking-confirm')
		).toBeEnabled();
	}
};

export const PhoneSlotsAvailable: Story = {
	name: 'Free times available (phone)',
	args: { medium: 'PHONE' },
	play: async () => {
		const view = await openBooking();
		await expect(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		).toBeInTheDocument();
	}
};

export const NoSlots: Story = {
	name: 'No free times',
	args: { loadSlots: () => Promise.resolve([]) },
	play: async () => {
		const view = await openBooking();
		await expect(
			await view.findByTestId('asker-self-booking-chat')
		).toBeInTheDocument();
	}
};

export const BookingError: Story = {
	name: 'Booking failed',
	args: { bookSlot: () => Promise.reject(new Error('offline')) },
	play: async () => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		);
		await userEvent.click(view.getByTestId('asker-self-booking-confirm'));
		await expect(await view.findByRole('alert')).toBeInTheDocument();
	}
};

export const TimeTaken: Story = {
	name: 'Time taken meanwhile',
	args: {
		bookSlot: () => Promise.reject(new Response(null, { status: 409 }))
	},
	play: async () => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		);
		await userEvent.click(view.getByTestId('asker-self-booking-confirm'));
		await expect(await view.findByRole('alert')).toBeInTheDocument();
	}
};

export const Booked: Story = {
	name: 'Booked',
	play: async ({ args }) => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		);
		await userEvent.click(view.getByTestId('asker-self-booking-confirm'));
		await expect(
			await view.findByTestId('asker-call-info-appointment')
		).toHaveTextContent(timeLabel);
		await expect(args.onBooked).toHaveBeenCalled();
	}
};

export const AlreadyBooked: Story = {
	name: 'Conversation already has an appointment',
	args: {
		load: (() => {
			let reads = 0;
			return () => Promise.resolve(reads++ === 0 ? [] : [booked]);
		})(),
		bookSlot: () =>
			Promise.reject(
				new Response(null, {
					status: 409,
					headers: { 'X-Reason': 'SELF_BOOKING_LIMIT_REACHED' }
				})
			)
	},
	play: async () => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${timeLabel}`)
		);
		await userEvent.click(view.getByTestId('asker-self-booking-confirm'));
		await expect(
			await view.findByTestId('asker-call-info-appointment')
		).toBeInTheDocument();
	}
};

/** FE#2287: times booked at once and requests side by side, with a legend. */
export const InstantAndRequestTimes: Story = {
	name: 'Instant times and requests',
	play: async () => {
		const view = await openBooking();
		const request = await view.findByTestId(
			`appointment-booking-slot-${requestLabel}`
		);
		await expect(request).toHaveAttribute('data-booking-mode', 'REQUEST');
		await expect(
			view.getByTestId(`appointment-booking-slot-${timeLabel}`)
		).toHaveAttribute('data-booking-mode', 'INSTANT');
		await expect(
			view.getByTestId('appointment-booking-legend')
		).toBeInTheDocument();
		await userEvent.click(request);
		await expect(
			view.getByTestId('asker-self-booking-confirm')
		).toHaveTextContent('Termin anfragen');
	}
};

/** The request is sent: it waits for the counsellor's confirmation. */
export const Requested: Story = {
	name: 'Requested – waiting for confirmation',
	args: { bookSlot: () => Promise.resolve(requested) },
	play: async () => {
		const view = await openBooking();
		await userEvent.click(
			await view.findByTestId(`appointment-booking-slot-${requestLabel}`)
		);
		await userEvent.click(view.getByTestId('asker-self-booking-confirm'));
		await expect(
			await view.findByTestId('asker-call-info-appointment')
		).toHaveTextContent(/Angefragt · /);
	}
};

/** A temporary advice seeker gets no hint to write in the chat. */
export const NoSlotsTemporaryAsker: Story = {
	name: 'No free times (temporary advice seeker)',
	args: { loadSlots: () => Promise.resolve([]), onRequestTime: undefined },
	play: async () => {
		const view = await openBooking();
		await expect(
			await view.findByText(/keine freie Zeit/)
		).toBeInTheDocument();
		await expect(view.queryByTestId('asker-self-booking-chat')).toBeNull();
	}
};
