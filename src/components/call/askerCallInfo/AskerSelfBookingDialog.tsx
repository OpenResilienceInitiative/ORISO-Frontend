/**
 * Self-booking (FE#1050, ADR-020 §4): "Termin anfragen" in the advice
 * seeker's call dialog opens the free times of the counsellor. The asker
 * picks a day and a time and books it as a video or phone appointment —
 * what they clicked. The server owns the free times and checks the slot
 * again when it books, so a time taken meanwhile comes back as a conflict,
 * which reads the free times again.
 *
 * Sprechstunden (FE#2287): a time is booked at once or is a request the
 * counsellor confirms; the picker marks the requests and the button says
 * "Termin anfragen" for one. Without free time, only an asker who can write
 * in the chat (registered, not temporary) is pointed there.
 */
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { M3Dialog } from '../../m3Dialog/M3Dialog';
import { AppointmentSlotPicker } from '../../appointmentBooking/AppointmentSlotPicker';
import type {
	AppointmentSlot,
	SelfBookingMedium,
	SessionAppointment
} from '../../../api/apiSessionAppointments';
import {
	SELF_BOOKING_DAYS,
	bookingWindow,
	firstSlotDay,
	requestTimesOn,
	slotAt,
	slotTimesOn
} from './askerSelfBooking';

export type LoadSlots = (
	sessionId: number,
	from: Date,
	to: Date,
	medium: SelfBookingMedium
) => Promise<AppointmentSlot[]>;

export type BookSlot = (
	sessionId: number,
	slot: AppointmentSlot & { kind: SelfBookingMedium }
) => Promise<SessionAppointment>;

export interface AskerSelfBookingDialogProps {
	sessionId: number;
	medium: SelfBookingMedium;
	onBack: () => void;
	onClose: () => void;
	onBooked: (appointment: SessionAppointment) => void;
	/** The conversation already has an upcoming appointment (one at a time). */
	onLimitReached: () => void;
	/**
	 * "Im Chat schreiben", when the counsellor has no free time. Without it
	 * (a temporary asker) the dialog gives no chat hint (FE#2287).
	 */
	onWriteInChat?: () => void;
	loadSlots: LoadSlots;
	bookSlot: BookSlot;
	fullScreen?: boolean;
}

type Slots = AppointmentSlot[] | 'loading' | 'error';

/** The `X-Reason` of a refused booking; `null` for another failure. */
const conflictReason = (cause: unknown): string | null =>
	cause instanceof Response && cause.status === 409
		? (cause.headers.get('X-Reason') ?? '')
		: null;

export const AskerSelfBookingDialog = ({
	sessionId,
	medium,
	onBack,
	onClose,
	onBooked,
	onLimitReached,
	onWriteInChat,
	loadSlots,
	bookSlot,
	fullScreen
}: AskerSelfBookingDialogProps) => {
	const { t } = useTranslation();
	const [slots, setSlots] = useState<Slots>('loading');
	const [day, setDay] = useState<Dayjs | null>(null);
	const [time, setTime] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<'taken' | 'failed'>();
	const [reads, setReads] = useState(0);

	useEffect(() => {
		let active = true;
		const { from, to } = bookingWindow(new Date());
		loadSlots(sessionId, from, to, medium).then(
			(found) => {
				if (!active) return;
				setSlots(found);
				/* Open on the first day with a free time, unless the asker
				   already chose a day that still has one. */
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

	const selectDay = (next: Dayjs) => {
		setDay(next);
		setTime(null);
		setProblem(undefined);
	};

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
		try {
			const booked = await bookSlot(sessionId, {
				startTime: chosen.startTime,
				endTime: chosen.endTime,
				kind: medium
			});
			onBooked(booked);
		} catch (cause) {
			setBusy(false);
			const reason = conflictReason(cause);
			if (reason === 'SELF_BOOKING_LIMIT_REACHED') {
				onLimitReached();
			} else if (reason !== null) {
				setProblem('taken');
				setTime(null);
				setReads((count) => count + 1);
			} else {
				setProblem('failed');
			}
		}
	};

	const empty = Array.isArray(slots) && slots.length === 0;
	const ready = Array.isArray(slots) && slots.length > 0;

	return (
		<M3Dialog
			open
			onClose={onClose}
			closeLabel={t('app.close')}
			icon={<EventAvailableOutlinedIcon />}
			title={t('videoCall.askerInfo.booking.title')}
			description={t(
				`videoCall.askerInfo.booking.description.${
					medium === 'PHONE' ? 'phone' : 'video'
				}`
			)}
			width={ready ? 720 : 480}
			fullScreen={fullScreen}
			data-testid="asker-self-booking"
			actions={
				ready
					? [
							{
								label: t('videoCall.askerInfo.booking.back'),
								onClick: onBack,
								testId: 'asker-self-booking-back'
							},
							{
								label: t(
									chosenIsRequest
										? 'videoCall.askerInfo.booking.confirmRequest'
										: 'videoCall.askerInfo.booking.confirm'
								),
								onClick: confirm,
								primary: true,
								disabled: !day || !time || busy,
								busy,
								testId: 'asker-self-booking-confirm'
							}
						]
					: empty && onWriteInChat
						? [
								{
									label: t(
										'videoCall.askerInfo.booking.back'
									),
									onClick: onBack,
									testId: 'asker-self-booking-back'
								},
								{
									label: t(
										'videoCall.askerInfo.booking.writeInChat'
									),
									onClick: onWriteInChat,
									primary: true,
									testId: 'asker-self-booking-chat'
								}
							]
						: [
								{
									label: t(
										'videoCall.askerInfo.booking.back'
									),
									onClick: onBack,
									primary: true,
									testId: 'asker-self-booking-back'
								}
							]
			}
		>
			{slots === 'loading' && (
				<p className="askerCallInfo__text" role="status">
					{t('videoCall.askerInfo.booking.loading')}
				</p>
			)}
			{slots === 'error' && (
				<p className="askerCallInfo__text" role="alert">
					{t('videoCall.askerInfo.booking.error')}
				</p>
			)}
			{empty && (
				<div className="askerCallInfo__none">
					<p className="askerCallInfo__text">
						{t('videoCall.askerInfo.booking.none')}
					</p>
					{onWriteInChat && (
						<p className="askerCallInfo__hint">
							{t('videoCall.askerInfo.requestHint')}
						</p>
					)}
				</div>
			)}
			{problem && (
				<p className="askerCallInfo__problem" role="alert">
					{t(`videoCall.askerInfo.booking.${problem}`)}
				</p>
			)}
			{ready && (
				<AppointmentSlotPicker
					layout="container"
					day={day}
					time={time}
					onDayChange={selectDay}
					onTimeChange={(next) => {
						setTime(next);
						setProblem(undefined);
					}}
					slotsForDay={slotsForDay}
					requestTimesForDay={requestTimesForDay}
					maxDate={dayjs().add(SELF_BOOKING_DAYS, 'day')}
				/>
			)}
		</M3Dialog>
	);
};
