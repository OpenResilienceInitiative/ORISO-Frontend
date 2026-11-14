/**
 * What a person sees on a Direkteinladung's entry page outside the call
 * (#2252, decisions 7, 10 and 12):
 * - before the waiting room opens: date, "In Kalender eintragen" (.ics) and,
 *   because the chat works at once, a way into it;
 * - after the validity ends: "Link abgelaufen" with "Neuen Link anfragen".
 * Presentational; which state applies is `invitationEntryPhase`.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import { buildAppointmentIcs } from '../../utils/appointmentIcs';
import { downloadICSFile } from '../../utils/downloadICSFile';
import { type InvitationSlot, waitingRoomOpensAt } from './invitationModel';
import './directInvitation.styles.scss';

const KEYS = 'directInvitation.entry';

const time = (date: Date, locale: string) =>
	date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** "In Kalender eintragen": the house .ics builder, one event per invitation. */
export const downloadInvitationIcs = ({
	title,
	slot,
	url,
	uid
}: {
	title: string;
	slot: InvitationSlot;
	url?: string;
	uid?: string;
}) => {
	const ics = buildAppointmentIcs({
		title,
		start: slot.start,
		end: slot.end,
		location: url,
		description: url,
		uid
	});
	downloadICSFile(title || 'appointment', ics);
};

export interface InvitationBeforeStartProps {
	slot: InvitationSlot;
	/** The counsellor, as the invitation names them. */
	counsellorName?: string;
	onAddToCalendar: () => void;
	/** The chat works before the call (decision 10); omit for call-only links. */
	onOpenChat?: () => void;
}

export const InvitationBeforeStart = ({
	slot,
	counsellorName,
	onAddToCalendar,
	onOpenChat
}: InvitationBeforeStartProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n?.language || 'de';
	return (
		<section
			className="invitationEntry"
			aria-labelledby="invitationEntryTitle"
			data-testid="invitation-before-start"
		>
			<EventOutlinedIcon aria-hidden className="invitationEntry__icon" />
			<h1 id="invitationEntryTitle" className="invitationEntry__title">
				{t(`${KEYS}.beforeStart.title`)}
			</h1>
			{counsellorName && (
				<p className="invitationEntry__text">
					{t(`${KEYS}.beforeStart.with`, { name: counsellorName })}
				</p>
			)}
			<p className="invitationEntry__date">
				<time dateTime={slot.start.toISOString()}>
					{slot.start.toLocaleDateString(locale, {
						weekday: 'long',
						day: 'numeric',
						month: 'long',
						year: 'numeric'
					})}
				</time>
				<span>
					{t(`${KEYS}.beforeStart.time`, {
						start: time(slot.start, locale),
						end: time(slot.end, locale)
					})}
				</span>
			</p>
			<p className="invitationEntry__text">
				{t(`${KEYS}.beforeStart.waitingRoom`, {
					time: time(waitingRoomOpensAt(slot.start), locale)
				})}
				{onOpenChat && ` ${t(`${KEYS}.beforeStart.chatNow`)}`}
			</p>
			<div className="invitationEntry__actions">
				<button
					type="button"
					className="invitationEntry__button invitationEntry__button--outlined"
					onClick={onAddToCalendar}
				>
					<EventOutlinedIcon aria-hidden />
					{t(`${KEYS}.beforeStart.addToCalendar`)}
				</button>
				{onOpenChat && (
					<button
						type="button"
						className="invitationEntry__button"
						onClick={onOpenChat}
					>
						{t(`${KEYS}.beforeStart.openChat`)}
					</button>
				)}
			</div>
		</section>
	);
};

export type NewLinkRequestState = 'idle' | 'sending' | 'sent' | 'failed';

export interface InvitationExpiredProps {
	requestState?: NewLinkRequestState;
	onRequestNewLink: () => void;
}

export const InvitationExpired = ({
	requestState = 'idle',
	onRequestNewLink
}: InvitationExpiredProps) => {
	const { t } = useTranslation();
	return (
		<section
			className="invitationEntry"
			aria-labelledby="invitationExpiredTitle"
			data-testid="invitation-expired"
		>
			<LinkOffOutlinedIcon
				aria-hidden
				className="invitationEntry__icon"
			/>
			<h1 id="invitationExpiredTitle" className="invitationEntry__title">
				{t(`${KEYS}.expired.title`)}
			</h1>
			{requestState === 'sent' ? (
				<p className="invitationEntry__text" role="status">
					{t(`${KEYS}.expired.sent`)}
				</p>
			) : (
				<>
					<p className="invitationEntry__text">
						{t(`${KEYS}.expired.text`)}
					</p>
					{requestState === 'failed' && (
						<p className="invitationEntry__error" role="alert">
							{t(`${KEYS}.expired.failed`)}
						</p>
					)}
					<div className="invitationEntry__actions">
						<button
							type="button"
							className="invitationEntry__button"
							disabled={requestState === 'sending'}
							aria-busy={requestState === 'sending' || undefined}
							onClick={onRequestNewLink}
						>
							{t(`${KEYS}.expired.request`)}
						</button>
					</div>
				</>
			)}
		</section>
	);
};
