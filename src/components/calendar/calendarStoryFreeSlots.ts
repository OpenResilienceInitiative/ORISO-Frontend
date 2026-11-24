/**
 * Sample free office hours for stories (FE#2494 *2c): Tuesday 09–12 and
 * Thursday 14–17 of the next two weeks, hourly, the Thursday ones within
 * two days as requests. Relative to the real clock, since the slot picker
 * hides what has passed.
 */
import dayjs from 'dayjs';
import type {
	AppointmentSlot,
	SelfBookingMedium,
	SessionAppointment
} from '../../api/apiSessionAppointments';

const WINDOWS: Record<number, [number, number]> = { 2: [9, 12], 4: [14, 17] };

export const storyFreeSlotList = (
	from: Date = new Date(),
	days = 14
): AppointmentSlot[] => {
	const slots: AppointmentSlot[] = [];
	const start = dayjs(from).startOf('day');
	for (let d = 0; d < days; d++) {
		const day = start.add(d, 'day');
		const window = WINDOWS[day.day()];
		if (!window) continue;
		for (let hour = window[0]; hour < window[1]; hour++) {
			const at = day.hour(hour);
			if (at.isBefore(from)) continue;
			slots.push({
				startTime: at.format(),
				endTime: at.add(1, 'hour').format(),
				bookingMode: at.diff(from, 'day') < 2 ? 'REQUEST' : 'INSTANT'
			});
		}
	}
	return slots;
};

export const storyFreeSlots = (
	_sessionId: number,
	from: Date,
	_to: Date,
	_medium: SelfBookingMedium
) => Promise.resolve(storyFreeSlotList(from));

/** Books like UserService: a request-mode slot comes back as a request. */
export const storyBookSlot = (
	sessionId: number,
	slot: AppointmentSlot & { kind: SelfBookingMedium }
): Promise<SessionAppointment> =>
	Promise.resolve({
		id: `story-${slot.startTime}`,
		sessionId,
		startTime: slot.startTime,
		endTime: slot.endTime,
		status: slot.bookingMode === 'REQUEST' ? 'REQUESTED' : 'SCHEDULED',
		kind: slot.kind
	});
