import { describe, expect, it } from 'vite-plus/test';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';
import {
	appointmentNoticeActions,
	buildAppointmentNoticePayload,
	calendarDayParam,
	LEGACY_NOTICE_SENTENCES,
	parseAppointmentNoticePayload,
	parseCalendarDayParam,
	recognizeLegacyAppointmentNotice,
	type AppointmentNotice
} from './appointmentNotice';
import { parseMessagePrefixes } from './messageConstants';

const start = new Date('2026-11-18T09:00:00Z');
const end = new Date('2026-11-18T10:00:00Z');
const before = new Date('2026-11-18T12:00:00Z');
const beforeEnd = new Date('2026-11-18T13:00:00Z');

describe('appointment notice payload', () => {
	it('carries the slot, the old slot of a move and the sentence', () => {
		const raw = `[SYSTEM_NOTIFICATION]${buildAppointmentNoticePayload({
			kind: 'moved',
			start,
			end,
			previousStart: before,
			previousEnd: beforeEnd,
			description: 'Termin verschoben auf: Mi 18. Nov 10:00–11:00'
		})}`;
		const parsed = parseMessagePrefixes(raw);
		expect(parsed.isSystemNotification).toBe(true);
		// Previews and older clients keep the sentence.
		expect(parsed.cleanedMessage).toBe(
			'Termin verschoben auf: Mi 18. Nov 10:00–11:00'
		);
		expect(parsed.systemNotificationAppointment).toEqual({
			kind: 'moved',
			slot: { start, end },
			previous: { start: before, end: beforeEnd }
		});
	});

	it('keeps no old slot on a booking or a cancellation', () => {
		for (const kind of ['created', 'cancelled'] as const) {
			const payload = JSON.parse(
				buildAppointmentNoticePayload({
					kind,
					start,
					end,
					previousStart: before,
					description: 'x'
				})
			);
			expect(parseAppointmentNoticePayload(payload)).toEqual({
				kind,
				slot: { start, end }
			});
		}
	});

	it.each([
		['another type', { type: 'OTHER', appointment: { kind: 'created' } }],
		[
			'an unknown kind',
			{
				type: 'APPOINTMENT_NOTICE',
				appointment: { kind: 'deleted', start: start.toISOString() }
			}
		],
		[
			'no start',
			{ type: 'APPOINTMENT_NOTICE', appointment: { kind: 'created' } }
		],
		[
			'a broken start',
			{
				type: 'APPOINTMENT_NOTICE',
				appointment: { kind: 'created', start: 'tomorrow' }
			}
		],
		['no appointment', { type: 'APPOINTMENT_NOTICE' }]
	])('draws no card for %s', (_name, payload) => {
		expect(parseAppointmentNoticePayload(payload)).toBeNull();
	});

	it('drops an end before the start', () => {
		expect(
			parseAppointmentNoticePayload({
				type: 'APPOINTMENT_NOTICE',
				appointment: {
					kind: 'created',
					start: end.toISOString(),
					end: start.toISOString()
				}
			})
		).toEqual({ kind: 'created', slot: { start: end } });
	});
});

describe('notices sent as plain sentences', () => {
	it.each([
		['Termin vereinbart: Mi 18. Nov 10:00–11:00', 'created'],
		['Termin verschoben auf: Mi 18. Nov 13:00–14:00', 'moved'],
		['Termin abgesagt: Mi 18. Nov 10:00–11:00', 'cancelled'],
		['Appointment cancelled: Wed, Nov 18 10:00–11:00', 'cancelled'],
		['Randevu şu tarihe ertelendi: 18 Kas Çar 10:00–11:00', 'moved']
	])('recognises "%s"', (text, kind) => {
		expect(recognizeLegacyAppointmentNotice(text)?.kind).toBe(kind);
	});

	it('keeps the sender’s own wording of the slot', () => {
		expect(
			recognizeLegacyAppointmentNotice(
				'Termin abgesagt: Mi 18. Nov 10:00–11:00'
			)
		).toEqual({ kind: 'cancelled', slotText: 'Mi 18. Nov 10:00–11:00' });
	});

	it.each([
		'Termin abgesagt: leider muss ich heute absagen, weil',
		'Termin abgesagt:',
		'Ich habe gesehen: Termin abgesagt: Mi 18. Nov 10:00',
		`Termin abgesagt: Mi 18. Nov 10:00–11:00 ${'und noch mehr Text '.repeat(4)}`,
		'Termin abgesagt: Mi 18. Nov\n10:00–11:00',
		''
	])('leaves an ordinary message alone: %j', (text) => {
		expect(recognizeLegacyAppointmentNotice(text)).toBeNull();
	});

	it('knows every sentence the app shipped', () => {
		const shipped = { de, en, fr, ru, ti, tr } as Record<string, any>;
		for (const [lang, bundle] of Object.entries(shipped)) {
			// The card's kinds; a request's notices (FE#2287) stay sentences.
			const { created, moved, cancelled } =
				bundle.sessionList.timeline.appointment.notice;
			expect(LEGACY_NOTICE_SENTENCES[lang]).toEqual({
				created,
				moved,
				cancelled
			});
		}
	});
});

describe('what the card offers', () => {
	const cancelled: AppointmentNotice = {
		kind: 'cancelled',
		slot: { start, end }
	};
	const booked: AppointmentNotice = { kind: 'created', slot: { start, end } };
	const legacyBooked: AppointmentNotice = {
		kind: 'created',
		slotText: 'Mi 18. Nov 10:00–11:00'
	};

	it('offers a new appointment after a cancellation', () => {
		expect(
			appointmentNoticeActions({
				notice: cancelled,
				canCreate: true,
				hasUpcoming: false,
				canOpenCalendar: true
			})
		).toEqual(['createNew']);
	});

	it('offers none once another appointment is booked', () => {
		expect(
			appointmentNoticeActions({
				notice: cancelled,
				canCreate: true,
				hasUpcoming: true,
				canOpenCalendar: true
			})
		).toEqual([]);
	});

	it('offers none to someone who may not create one', () => {
		expect(
			appointmentNoticeActions({
				notice: cancelled,
				canCreate: false,
				hasUpcoming: false,
				canOpenCalendar: true
			})
		).toEqual([]);
	});

	it('opens a booked or moved appointment in the calendar', () => {
		expect(
			appointmentNoticeActions({
				notice: booked,
				canCreate: true,
				hasUpcoming: true,
				canOpenCalendar: true
			})
		).toEqual(['openCalendar']);
		expect(
			appointmentNoticeActions({
				notice: { ...booked, kind: 'moved' },
				canCreate: false,
				hasUpcoming: false,
				canOpenCalendar: true
			})
		).toEqual(['openCalendar']);
	});

	it('offers no calendar without one or without the day', () => {
		expect(
			appointmentNoticeActions({
				notice: booked,
				canCreate: true,
				hasUpcoming: false,
				canOpenCalendar: false
			})
		).toEqual([]);
		expect(
			appointmentNoticeActions({
				notice: legacyBooked,
				canCreate: true,
				hasUpcoming: false,
				canOpenCalendar: true
			})
		).toEqual([]);
	});
});

describe('the calendar day in the link', () => {
	it('names the local day and reads it back', () => {
		const day = new Date(2026, 10, 18, 23, 30);
		expect(calendarDayParam(day)).toBe('2026-11-18');
		expect(parseCalendarDayParam('2026-11-18')).toEqual(
			new Date(2026, 10, 18)
		);
	});

	it.each([null, '', '18.11.2026', '2026-02-30', '2026-13-01'])(
		'ignores %j',
		(value) => {
			expect(parseCalendarDayParam(value)).toBeUndefined();
		}
	);
});
