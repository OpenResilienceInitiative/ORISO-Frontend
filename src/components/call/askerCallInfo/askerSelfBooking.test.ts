import dayjs from 'dayjs';
import { describe, expect, it } from 'vite-plus/test';
import {
	SELF_BOOKING_DAYS,
	bookingWindow,
	firstSlotDay,
	mediumOfCall,
	slotAt,
	slotTimesOn
} from './askerSelfBooking';

const slot = (start: Date, minutes = 60) => ({
	startTime: start.toISOString(),
	endTime: new Date(start.getTime() + minutes * 60_000).toISOString()
});

/* Local times: the picker shows the asker's wall clock. */
const thu9 = new Date(2026, 10, 19, 9, 0);
const thu930 = new Date(2026, 10, 19, 9, 30);
const fri14 = new Date(2026, 10, 20, 14, 0);
const slots = [slot(fri14), slot(thu930), slot(thu9)];

describe('askerSelfBooking (FE#1050)', () => {
	it('asks for the next fourteen days, the window the server allows', () => {
		const now = new Date(2026, 10, 17, 10, 15);
		const { from, to } = bookingWindow(now);
		expect(from).toEqual(now);
		expect(SELF_BOOKING_DAYS).toBe(14);
		expect(to.getTime() - from.getTime()).toBe(14 * 24 * 3_600_000);
	});

	it('lists the local start times of one day, earliest first', () => {
		expect(slotTimesOn(slots, dayjs(thu9))).toEqual(['09:00', '09:30']);
		expect(slotTimesOn(slots, dayjs(fri14))).toEqual(['14:00']);
		expect(slotTimesOn(slots, dayjs(new Date(2026, 10, 21)))).toEqual([]);
	});

	it('finds the slot the picker confirmed, by its instant', () => {
		const confirmed = dayjs(thu930).format();
		expect(slotAt(slots, confirmed)).toEqual(slot(thu930));
		expect(slotAt(slots, dayjs(thu930).add(7, 'minute').format())).toBe(
			undefined
		);
	});

	it('opens on the first day that has a free time', () => {
		expect(firstSlotDay(slots)?.isSame(dayjs(thu9), 'day')).toBe(true);
		expect(firstSlotDay([])).toBeNull();
	});

	it('books what the asker clicked: video or phone', () => {
		expect(mediumOfCall(true)).toBe('VIDEO');
		expect(mediumOfCall(false)).toBe('PHONE');
	});
});
