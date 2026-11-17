/**
 * What an advice seeker gets from the call buttons: only counsellors start
 * calls (Frank, 17 Nov 2026). The dialog names the conversation's next
 * appointment — date, time and medium — or, without one, offers to ask for
 * a time. The house `M3Dialog`; the appointment uses the timeline's modality
 * icons and date format, so it reads like the appointment below the header.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { M3Dialog, type M3DialogAction } from '../../m3Dialog/M3Dialog';
import {
	apiBookAppointmentSlot,
	apiGetAppointmentSlots,
	apiGetSessionAppointments,
	type SelfBookingMedium,
	type SessionAppointment
} from '../../../api/apiSessionAppointments';
import { MODALITY_ICON } from '../../sessionsList/timeline/AppointmentKindGlyph';
import { formatEntrySlot } from '../../sessionsList/timeline/timelineModel';
import type { EntryModality } from '../../sessionsList/timeline/timelineModel';
import { normalizeTimelineLocale } from '../../sessionsList/futureTimelineTime';
import {
	askerCallInfoState,
	type AskerCallInfoState,
	type AskerCallMedium
} from './askerCallInfo';
import {
	AskerSelfBookingDialog,
	type BookSlot,
	type LoadSlots
} from './AskerSelfBookingDialog';
import './askerCallInfo.styles.scss';

const GLYPH: Record<AskerCallMedium, EntryModality> = {
	video: 'video',
	phone: 'audio',
	onsite: 'location',
	chat: 'chat'
};

export interface AskerCallInfoDialogProps {
	open: boolean;
	onClose: () => void;
	state: AskerCallInfoState;
	/**
	 * "Termin anfragen". Without it the dialog only explains how to ask
	 * (in the chat) and offers no button.
	 */
	onRequestTime?: () => void;
	/** Phones: the caller decides (`useResponsive().untilL`). */
	fullScreen?: boolean;
	/**
	 * FE#1050: the asker has just booked the appointment shown, or a booking
	 * was refused because the conversation already has this one.
	 */
	notice?: 'booked' | 'limit';
	/** "Termin anfragen" opens the free times (FE#1050), not the chat. */
	selfBooking?: boolean;
}

export const AskerCallInfoDialog = ({
	open,
	onClose,
	state,
	onRequestTime,
	fullScreen,
	notice,
	selfBooking
}: AskerCallInfoDialogProps) => {
	const { t, i18n } = useTranslation();
	const locale = normalizeTimelineLocale(
		i18n?.resolvedLanguage,
		i18n?.language
	);
	const offerRequest = state.status === 'none' && Boolean(onRequestTime);
	const actions: M3DialogAction[] = offerRequest
		? [
				{ label: t('app.close'), onClick: onClose },
				{
					label: t('videoCall.askerInfo.request'),
					onClick: () => onRequestTime?.(),
					primary: true,
					testId: 'asker-call-info-request'
				}
			]
		: [{ label: t('app.close'), onClick: onClose, primary: true }];

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			closeLabel={t('app.close')}
			icon={<EventOutlinedIcon />}
			title={t('videoCall.askerInfo.title')}
			description={t('videoCall.askerInfo.description')}
			actions={actions}
			width={480}
			fullScreen={fullScreen}
			data-testid="asker-call-info"
		>
			{state.status === 'appointment' && notice && (
				<p className="askerCallInfo__booked" role="status">
					{t(`videoCall.askerInfo.booking.${notice}`)}
				</p>
			)}
			{state.status === 'appointment' && (
				<AppointmentCard
					label={t('videoCall.askerInfo.next')}
					medium={t(`videoCall.askerInfo.medium.${state.medium}`)}
					slot={formatEntrySlot(
						{ start: state.start, end: state.end },
						locale
					)}
					glyph={GLYPH[state.medium]}
				/>
			)}
			{state.status === 'none' && (
				<div className="askerCallInfo__none">
					<p className="askerCallInfo__text">
						{t('videoCall.askerInfo.none')}
					</p>
					<p className="askerCallInfo__hint">
						{t(
							selfBooking
								? 'videoCall.askerInfo.requestHintBooking'
								: 'videoCall.askerInfo.requestHint'
						)}
					</p>
				</div>
			)}
			{state.status === 'loading' && (
				<p className="askerCallInfo__text" role="status">
					{t('videoCall.askerInfo.loading')}
				</p>
			)}
			{state.status === 'error' && (
				<p className="askerCallInfo__text" role="alert">
					{t('videoCall.askerInfo.error')}
				</p>
			)}
		</M3Dialog>
	);
};

const AppointmentCard = ({
	label,
	medium,
	slot,
	glyph
}: {
	label: string;
	medium: string;
	slot: string;
	glyph: EntryModality;
}) => {
	const Icon = MODALITY_ICON[glyph];
	return (
		<div
			className="askerCallInfo__appointment"
			data-testid="asker-call-info-appointment"
		>
			<span className="askerCallInfo__label">{label}</span>
			<span className="askerCallInfo__row">
				<span className="askerCallInfo__icon" aria-hidden="true">
					<Icon aria-hidden="true" focusable="false" />
				</span>
				<span className="askerCallInfo__details">
					<span className="askerCallInfo__slot">{slot}</span>
					<span className="askerCallInfo__medium">{medium}</span>
				</span>
			</span>
		</div>
	);
};

/**
 * The dialog with its data: reads the conversation's appointments each time
 * it opens (the asker may read them, `SessionAppointmentService`). With a
 * `medium` — the button the asker clicked — "Termin anfragen" opens the
 * counsellor's free times to book one (FE#1050); without one it is the
 * plain `onRequestTime`.
 */
export const AskerCallInfo = ({
	sessionId,
	open,
	onClose,
	onRequestTime,
	fullScreen,
	medium,
	onBooked,
	load = apiGetSessionAppointments,
	loadSlots = apiGetAppointmentSlots,
	bookSlot = apiBookAppointmentSlot
}: Omit<AskerCallInfoDialogProps, 'state' | 'notice' | 'selfBooking'> & {
	sessionId: number;
	medium?: SelfBookingMedium;
	onBooked?: (appointment: SessionAppointment) => void;
	load?: (sessionId: number) => Promise<SessionAppointment[]>;
	loadSlots?: LoadSlots;
	bookSlot?: BookSlot;
}) => {
	const [appointments, setAppointments] = useState<
		SessionAppointment[] | 'error' | undefined
	>();
	const [booking, setBooking] = useState(false);
	const [notice, setNotice] = useState<'booked' | 'limit'>();
	/* Counts the reads; a refused booking reads the appointments again. */
	const [reads, setReads] = useState(0);
	useEffect(() => {
		if (!open) {
			setBooking(false);
			setNotice(undefined);
			return undefined;
		}
		let active = true;
		setAppointments(undefined);
		load(sessionId).then(
			(items) => active && setAppointments(items),
			() => active && setAppointments('error')
		);
		return () => {
			active = false;
		};
	}, [open, sessionId, load, reads]);

	if (open && booking && medium) {
		return (
			<AskerSelfBookingDialog
				sessionId={sessionId}
				medium={medium}
				fullScreen={fullScreen}
				loadSlots={loadSlots}
				bookSlot={bookSlot}
				onClose={onClose}
				onBack={() => setBooking(false)}
				onWriteInChat={onRequestTime}
				onBooked={(appointment) => {
					setAppointments((known) => [
						...(Array.isArray(known) ? known : []),
						appointment
					]);
					setNotice('booked');
					setBooking(false);
					onBooked?.(appointment);
				}}
				onLimitReached={() => {
					setNotice('limit');
					setBooking(false);
					setReads((count) => count + 1);
				}}
			/>
		);
	}

	return (
		<AskerCallInfoDialog
			open={open}
			onClose={onClose}
			onRequestTime={medium ? () => setBooking(true) : onRequestTime}
			fullScreen={fullScreen}
			notice={notice}
			selfBooking={Boolean(medium)}
			state={askerCallInfoState(appointments, new Date())}
		/>
	);
};
