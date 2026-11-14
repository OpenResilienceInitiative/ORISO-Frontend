/**
 * What a person sees on a Direkteinladung's entry page outside the call
 * (#2252, decisions 7, 10 and 12):
 * - before the waiting room opens: date, "Termin eintragen" (.ics) and,
 *   because the chat works at once, the way into it;
 * - after the validity ends: "Link abgelaufen" with "Neuen Link anfragen".
 *
 * Both are rooms of the one waiting-room frame (`EntryRoomShell` →
 * `WaitingRoomFrame`, the shared bar), not pages of their own. Which applies
 * is `invitationEntryPhase`, fed by the server's `callOpensAt`/`expiresAt`.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import { buildAppointmentIcs } from '../../utils/appointmentIcs';
import { downloadICSFile } from '../../utils/downloadICSFile';
import { EntryRoomShell } from '../anonymousChat/entryRoom/EntryRoomShell';
import { WaitingRoomBar } from '../waitingRoom/WaitingRoomBar';
import { GroupCalendarActions } from '../groupChat/entryRoom/GroupCalendarActions';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import type { InvitationSlot } from './invitationModel';

const KEYS = 'directInvitation.entry';

const time = (date: Date, locale: string) =>
	date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

/** "Termin eintragen": the house .ics builder, one event per invitation. */
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

/** The round icon above the room's words, as `CallNotice` draws it. */
const RoomIcon = ({ children }: { children: React.ReactNode }) => (
	<Box
		aria-hidden
		sx={{
			'mx': 'auto',
			'width': 72,
			'height': 72,
			'borderRadius': '50%',
			'bgcolor': registrationMd3.surfaceContainer,
			'color': registrationMd3.primary,
			'display': 'flex',
			'alignItems': 'center',
			'justifyContent': 'center',
			'& svg': { fontSize: 34 }
		}}
	>
		{children}
	</Box>
);

const RoomText = ({ children }: { children: React.ReactNode }) => (
	<Typography sx={{ ...registrationScreenIntroSx, mt: 1.5 }}>
		{children}
	</Typography>
);

const roomColumnSx = {
	flex: 1,
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'center',
	maxWidth: 520,
	width: '100%',
	mx: 'auto',
	textAlign: 'center'
} as const;

export interface InvitationBeforeStartProps {
	slot: InvitationSlot;
	/** When the call waiting room opens: the server's `callOpensAt`. */
	callOpensAt: Date;
	/** The counsellor, as the invitation names them. */
	counsellorName?: string;
	onAddToCalendar: () => void;
	/** The chat works before the call (decision 10). */
	onOpenChat: () => void;
}

export const InvitationBeforeStart = ({
	slot,
	callOpensAt,
	counsellorName,
	onAddToCalendar,
	onOpenChat
}: InvitationBeforeStartProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n?.language || 'de';
	const opens = t(`${KEYS}.beforeStart.waitingRoom`, {
		time: time(callOpensAt, locale)
	});
	return (
		<EntryRoomShell
			kicker={t(`${KEYS}.beforeStart.title`)}
			statusLine={opens}
		>
			<Box
				component="section"
				aria-labelledby="invitationEntryTitle"
				data-testid="invitation-before-start"
				sx={roomColumnSx}
			>
				<RoomIcon>
					<EventOutlinedIcon />
				</RoomIcon>
				<Typography
					id="invitationEntryTitle"
					component="h1"
					sx={{ ...registrationScreenTitleSx, mt: 3 }}
				>
					<time dateTime={slot.start.toISOString()}>
						{slot.start.toLocaleDateString(locale, {
							weekday: 'long',
							day: 'numeric',
							month: 'long',
							year: 'numeric'
						})}
					</time>
				</Typography>
				<RoomText>
					{t(`${KEYS}.beforeStart.time`, {
						start: time(slot.start, locale),
						end: time(slot.end, locale)
					})}
					{counsellorName &&
						` · ${t(`${KEYS}.beforeStart.with`, { name: counsellorName })}`}
				</RoomText>
				<RoomText>
					{`${opens} ${t(`${KEYS}.beforeStart.chatNow`)}`}
				</RoomText>
			</Box>
			<WaitingRoomBar
				stacked
				primary={{
					label: t(`${KEYS}.beforeStart.openChat`),
					onClick: onOpenChat,
					testId: 'invitation-open-chat'
				}}
			>
				<GroupCalendarActions
					inline={false}
					onAddThis={onAddToCalendar}
				/>
			</WaitingRoomBar>
		</EntryRoomShell>
	);
};

export type NewLinkRequestState = 'idle' | 'sending' | 'sent';

export interface InvitationExpiredProps {
	requestState?: NewLinkRequestState;
	/**
	 * Only a signed-in person who is in the conversation may ask. A guest
	 * whose temporary account is not signed in on this device cannot; the
	 * page says so and offers the sign-in for people with an account.
	 */
	signedIn: boolean;
	onRequestNewLink: () => void;
	onSignIn: () => void;
}

export const InvitationExpired = ({
	requestState = 'idle',
	signedIn,
	onRequestNewLink,
	onSignIn
}: InvitationExpiredProps) => {
	const { t } = useTranslation();
	const sent = requestState === 'sent';
	return (
		<EntryRoomShell
			kicker={t(`${KEYS}.beforeStart.title`)}
			statusLine={t(`${KEYS}.expired.title`)}
		>
			<Box
				component="section"
				aria-labelledby="invitationExpiredTitle"
				data-testid="invitation-expired"
				sx={roomColumnSx}
			>
				<RoomIcon>
					<LinkOffOutlinedIcon />
				</RoomIcon>
				<Typography
					id="invitationExpiredTitle"
					component="h1"
					sx={{ ...registrationScreenTitleSx, mt: 3 }}
				>
					{t(`${KEYS}.expired.title`)}
				</Typography>
				{sent ? (
					<Typography
						role="status"
						sx={{ ...registrationScreenIntroSx, mt: 1.5 }}
					>
						{t(`${KEYS}.expired.sent`)}
					</Typography>
				) : (
					<RoomText>
						{t(
							`${KEYS}.expired.${signedIn ? 'text' : 'signedOut'}`
						)}
					</RoomText>
				)}
			</Box>
			{!sent && (
				<WaitingRoomBar
					primary={
						signedIn
							? {
									label: t(`${KEYS}.expired.request`),
									onClick: onRequestNewLink,
									busy: requestState === 'sending',
									disabled: requestState === 'sending',
									testId: 'invitation-request-new-link'
								}
							: {
									label: t(`${KEYS}.expired.signIn`),
									onClick: onSignIn,
									testId: 'invitation-sign-in'
								}
					}
				/>
			)}
		</EntryRoomShell>
	);
};
