/**
 * Self-booking (FE#1050, ADR-020 §4): the rules of the asker's slot picker,
 * without React. The server decides which times are free; this only lays
 * them out on the asker's wall clock.
 */
import dayjs, { type Dayjs } from 'dayjs';
import type {
	AppointmentSlot,
	SelfBookingMedium
} from '../../../api/apiSessionAppointments';

/** The longest window the UserService answers. */
export const SELF_BOOKING_DAYS = 14;

export const bookingWindow = (now: Date) => ({
	from: now,
	to: dayjs(now).add(SELF_BOOKING_DAYS, 'day').toDate()
});

/** The local start times (HH:mm) of the slots on `day`, earliest first. */
export const slotTimesOn = (slots: AppointmentSlot[], day: Dayjs) =>
	slots
		.map((slot) => dayjs(slot.startTime))
		.filter((start) => start.isSame(day, 'day'))
		.sort((a, b) => a.valueOf() - b.valueOf())
		.map((start) => start.format('HH:mm'));

/**
 * FE#2287: the local start times (HH:mm) of the slots on `day` that are
 * requests the counsellor confirms; the others are booked at once.
 */
export const requestTimesOn = (slots: AppointmentSlot[], day: Dayjs) =>
	slotTimesOn(
		slots.filter((slot) => slot.bookingMode === 'REQUEST'),
		day
	);

/** The slot that starts at the instant the picker confirmed. */
export const slotAt = (slots: AppointmentSlot[], isoDateTime: string) => {
	const at = dayjs(isoDateTime).valueOf();
	return slots.find((slot) => dayjs(slot.startTime).valueOf() === at);
};

/** The day the picker opens on: the first one with a free time. */
export const firstSlotDay = (slots: AppointmentSlot[]): Dayjs | null => {
	if (slots.length === 0) return null;
	const first = slots.reduce((a, b) =>
		dayjs(a.startTime).isBefore(dayjs(b.startTime)) ? a : b
	);
	return dayjs(first.startTime).startOf('day');
};

export const mediumOfCall = (isVideo: boolean): SelfBookingMedium =>
	isVideo ? 'VIDEO' : 'PHONE';
