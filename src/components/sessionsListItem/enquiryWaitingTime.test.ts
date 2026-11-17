import { describe, expect, it } from 'vite-plus/test';
import { getEnquiryWaitingTime } from './enquiryWaitingTime';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 10, 10, 12, 0, 0);

describe('getEnquiryWaitingTime', () => {
	it('counts minutes under an hour, never below one', () => {
		expect(getEnquiryWaitingTime(now - 10 * 1000, now)).toEqual({
			unit: 'minutes',
			count: 1
		});
		expect(
			getEnquiryWaitingTime(now - 12 * MINUTE - 30 * 1000, now)
		).toEqual({ unit: 'minutes', count: 12 });
		expect(getEnquiryWaitingTime(now - 59 * MINUTE, now)).toEqual({
			unit: 'minutes',
			count: 59
		});
	});

	// Mail counselling promises an answer within 48 working hours, so the
	// hours keep counting past a day instead of switching to days.
	it('counts hours from one hour up to a week', () => {
		expect(getEnquiryWaitingTime(now - HOUR, now)).toEqual({
			unit: 'hours',
			count: 1
		});
		expect(
			getEnquiryWaitingTime(now - 47 * HOUR - 59 * MINUTE, now)
		).toEqual({ unit: 'hours', count: 47 });
		expect(getEnquiryWaitingTime(now - 7 * DAY + MINUTE, now)).toEqual({
			unit: 'hours',
			count: 167
		});
	});

	it('counts weeks from seven days on', () => {
		expect(getEnquiryWaitingTime(now - 7 * DAY, now)).toEqual({
			unit: 'weeks',
			count: 1
		});
		expect(getEnquiryWaitingTime(now - 20 * DAY, now)).toEqual({
			unit: 'weeks',
			count: 2
		});
	});

	it('treats a start in the future (clock skew) as one minute', () => {
		expect(getEnquiryWaitingTime(now + 5 * MINUTE, now)).toEqual({
			unit: 'minutes',
			count: 1
		});
	});

	it('returns null without a usable start', () => {
		expect(getEnquiryWaitingTime(Number.NaN, now)).toBeNull();
	});
});
