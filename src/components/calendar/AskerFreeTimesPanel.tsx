/**
 * "Freie Sprechzeiten" (ORISO-Frontend#2494 *2c): next to the advice
 * seeker's "Meine Termine", the free office hours of their counsellor, to
 * book one straight away. It shows only while the counsellor offers any:
 * UserService builds the free times from the Sprechstunden alone
 * (`CounsellorFreeTime`), so no free time in the booking window means no
 * panel. Day grid and times are the shared `AppointmentSlotPicker` of the
 * call dialog's "Termin buchen" (FE#1050), with the same rules for
 * requests, conflicts and the one-appointment limit.
 */
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { Button } from '@mui/material';
import { onRovingRadioKey } from './rovingRadio';
import { ReactComponent as ClockIcon } from '../../resources/img/icons/clock.svg';
import { AppointmentSlotPicker } from '../appointmentBooking/AppointmentSlotPicker';
import type {
	AppointmentSlot,
	SelfBookingMedium,
	SessionAppointment
} from '../../api/apiSessionAppointments';
import {
	SELF_BOOKING_DAYS,
	bookingWindow,
	firstSlotDay,
	requestTimesOn,
	slotAt,
	slotTimesOn
} from '../call/askerCallInfo/askerSelfBooking';
import type {
	BookSlot,
	LoadSlots
} from '../call/askerCallInfo/AskerSelfBookingDialog';

export interface AskerFreeTimesPanelProps {
	/** The conversation whose counsellor's office hours are offered. */
	sessionId: number;
	/** The counsellor's name, as the conversation shows it. */
	counsellorName: string;
	/** The media the asker may book; the first is chosen. */
	media?: readonly SelfBookingMedium[];
	loadSlots: LoadSlots;
	bookSlot: BookSlot;
	onBooked: (appointment: SessionAppointment) => void;
	/** The conversation already has an upcoming appointment. */
	onLimitReached?: () => void;
}

type Slots = AppointmentSlot[] | 'loading' | 'error';

const MEDIA: readonly SelfBookingMedium[] = ['VIDEO', 'PHONE'];

/** The `X-Reason` of a refused booking; `null` for another failure. */
const conflictReason = (cause: unknown): string | null =>
	cause instanceof Response && cause.status === 409
		? (cause.headers.get('X-Reason') ?? '')
		: null;

export const AskerFreeTimesPanel = ({
	sessionId,
	counsellorName,
	media = MEDIA,
	loadSlots,
	bookSlot,
	onBooked,
	onLimitReached
}: AskerFreeTimesPanelProps) => {
	const { t } = useTranslation();
	const [medium, setMedium] = useState<SelfBookingMedium>(media[0]);
	const [slots, setSlots] = useState<Slots>('loading');
	const [day, setDay] = useState<Dayjs | null>(null);
	const [time, setTime] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<'taken' | 'failed'>();
	/* What the last booking did, in the words of "Termin buchen". */
	const [notice, setNotice] = useState<'booked' | 'requested' | 'limit'>();
	const [reads, setReads] = useState(0);

	useEffect(() => {
		let active = true;
		const { from, to } = bookingWindow(new Date());
		loadSlots(sessionId, from, to, medium).then(
			(found) => {
				if (!active) return;
				setSlots(found);
				setDay((chosen) =>
					chosen && slotTimesOn(found, chosen).length > 0
						? chosen
						: firstSlotDay(found)
				);
			},
			() => active && setSlots('error')
		);
		return () => {
			active = false;
		};
	}, [sessionId, medium, loadSlots, reads]);

	const chooseMedium = (value: SelfBookingMedium) => {
		setMedium(value);
		setTime(null);
		setProblem(undefined);
	};

	const slotsForDay = useCallback(
		(on: Dayjs) => (Array.isArray(slots) ? slotTimesOn(slots, on) : []),
		[slots]
	);
	const requestTimesForDay = useCallback(
		(on: Dayjs) => (Array.isArray(slots) ? requestTimesOn(slots, on) : []),
		[slots]
	);
	const chosenIsRequest =
		day !== null && time !== null && requestTimesForDay(day).includes(time);

	const confirm = async () => {
		if (!day || !time || !Array.isArray(slots)) return;
		const [hour, minute] = time.split(':').map(Number);
		const chosen = slotAt(
			slots,
			day.hour(hour).minute(minute).second(0).millisecond(0).format()
		);
		if (!chosen) return;
		setBusy(true);
		setProblem(undefined);
		setNotice(undefined);
		try {
			const booked = await bookSlot(sessionId, {
				startTime: chosen.startTime,
				endTime: chosen.endTime,
				kind: medium
			});
			setBusy(false);
			setTime(null);
			setReads((count) => count + 1);
			setNotice(booked.status === 'REQUESTED' ? 'requested' : 'booked');
			onBooked(booked);
		} catch (cause) {
			setBusy(false);
			const reason = conflictReason(cause);
			if (reason === 'SELF_BOOKING_LIMIT_REACHED') {
				setNotice('limit');
				onLimitReached?.();
			} else if (reason !== null) {
				setProblem('taken');
				setTime(null);
				setReads((count) => count + 1);
			} else {
				setProblem('failed');
			}
		}
	};

	/* No office hours (or none left) in the booking window of the first
	   medium read: no panel at all (decision *2c). A failed read also
	   stays quiet: "Meine Termine" next to it is what the asker came for. */
	if (slots === 'error') return null;
	if (Array.isArray(slots) && slots.length === 0 && medium === media[0])
		return null;

	return (
		<section
			className="calendarFreeTimes"
			aria-labelledby="calendarFreeTimesTitle"
			data-testid="calendar-free-times"
			aria-busy={slots === 'loading' || undefined}
		>
			<header className="calendarFreeTimes__header">
				<ClockIcon
					aria-hidden
					focusable="false"
					className="calendarFreeTimes__icon"
				/>
				<h2
					id="calendarFreeTimesTitle"
					className="calendarFreeTimes__title"
				>
					{t('calendar.freeTimes.title')}
				</h2>
			</header>
			<p className="calendarFreeTimes__description">
				{t('calendar.freeTimes.description', { name: counsellorName })}
			</p>
			{media.length > 1 && (
				<div
					className="calendarNewEntry__tabs calendarFreeTimes__media"
					role="radiogroup"
					aria-label={t('calendar.freeTimes.title')}
				>
					{media.map((value) => (
						<button
							key={value}
							type="button"
							role="radio"
							className="calendarNewEntry__tab"
							aria-checked={medium === value}
							tabIndex={medium === value ? 0 : -1}
							onClick={() => chooseMedium(value)}
							onKeyDown={(event) =>
								onRovingRadioKey(
									event,
									media,
									medium,
									chooseMedium
								)
							}
							data-cy={`calendar-free-times-${value.toLowerCase()}`}
						>
							{t(
								`calendar.freeTimes.medium.${value.toLowerCase()}`
							)}
						</button>
					))}
				</div>
			)}
			{slots === 'loading' && (
				<p className="calendarFreeTimes__status" role="status">
					{t('videoCall.askerInfo.booking.loading')}
				</p>
			)}
			{Array.isArray(slots) && slots.length === 0 && (
				<p className="calendarFreeTimes__status">
					{t('videoCall.askerInfo.booking.none')}
				</p>
			)}
			{notice && (
				<p
					className="calendarFreeTimes__status"
					role="status"
					data-testid="calendar-free-times-notice"
				>
					{t(`videoCall.askerInfo.booking.${notice}`)}
				</p>
			)}
			{problem && (
				<p className="calendarFreeTimes__problem" role="alert">
					{t(`videoCall.askerInfo.booking.${problem}`)}
				</p>
			)}
			{Array.isArray(slots) && slots.length > 0 && (
				<>
					<AppointmentSlotPicker
						layout="container"
						day={day}
						time={time}
						onDayChange={(next) => {
							setDay(next);
							setTime(null);
							setProblem(undefined);
						}}
						onTimeChange={(next) => {
							setTime(next);
							setProblem(undefined);
						}}
						slotsForDay={slotsForDay}
						requestTimesForDay={requestTimesForDay}
						maxDate={dayjs().add(SELF_BOOKING_DAYS, 'day')}
					/>
					<div className="calendarFreeTimes__actions">
						<Button
							variant="contained"
							disableElevation
							disabled={!day || !time || busy}
							onClick={() => void confirm()}
							data-testid="calendar-free-times-book"
							sx={{
								textTransform: 'none',
								borderRadius: '999px'
							}}
						>
							{t(
								chosenIsRequest
									? 'videoCall.askerInfo.booking.confirmRequest'
									: 'videoCall.askerInfo.booking.confirm'
							)}
						</Button>
					</div>
				</>
			)}
		</section>
	);
};
