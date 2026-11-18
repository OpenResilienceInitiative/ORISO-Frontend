/**
 * A 1:1 appointment change in the chat (FE#1960 notice) as its own card
 * instead of a plain bubble: booked, moved (old → new) or cancelled (struck
 * through), each with the calendar's own glyph — the ones its menus use for
 * "Verschieben" and "Absagen".
 *
 * After a cancellation the counsellor gets "Neuen Termin anlegen", which
 * opens the room's own create dialog; a booked or moved appointment offers
 * "Im Kalender öffnen" on its day to anyone who has "Meine Termine".
 */
import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
	ActiveSessionContext,
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { normalizeTimelineLocale } from '../sessionsList/futureTimelineTime';
import { formatEntrySlot } from '../sessionsList/timeline/timelineModel';
import { useAppointmentCreate } from '../sessionsList/timeline/appointmentCreateBridge';
import { ChatSystemMessageCard } from './ChatSystemMessageCard';
import {
	appointmentNoticeActions,
	calendarDayParam,
	type AppointmentNotice,
	type AppointmentNoticeAction,
	type AppointmentNoticeKind,
	type AppointmentNoticeSlot
} from './appointmentNotice';

/** The calendar of ADR-032 ("Meine Termine"). */
export const CALENDAR_PATH = '/booking/events';

const ICON: Record<
	AppointmentNoticeKind,
	React.ComponentType<{ fontSize?: 'small' | 'medium' }>
> = {
	created: EventAvailableOutlinedIcon,
	moved: EventRepeatOutlinedIcon,
	cancelled: EventBusyOutlinedIcon
};

/** M3 roles: booked and moved are news, a cancellation is muted. */
const TILE: Record<AppointmentNoticeKind, { bg: string; fg: string }> = {
	created: {
		bg: 'var(--m3-primary-container, #ffdad6)',
		fg: 'var(--m3-on-primary-container, #410002)'
	},
	moved: {
		bg: 'var(--m3-secondary-container, #ffdad6)',
		fg: 'var(--m3-on-secondary-container, #2c1512)'
	},
	cancelled: {
		bg: 'var(--m3-surface-container-highest, #e6e1e1)',
		fg: 'var(--m3-on-surface-variant, #444748)'
	}
};

const onSurface = 'var(--m3-on-surface, #1a1c1e)';
const primary = 'var(--m3-primary, #ba1a1a)';
const onPrimary = 'var(--m3-on-primary, #ffffff)';
const outline = 'var(--m3-outline, #857371)';

/** The call card's action shape (CallTimelineSystemMessage): an M3 pill. */
const actionSx = {
	'minHeight': 40,
	'borderRadius': 999,
	'px': 2.5,
	'textTransform': 'none',
	'fontSize': 14,
	'fontWeight': 600,
	'letterSpacing': '0.1px',
	'&:focus-visible': {
		outline: '3px solid var(--m3-primary-container, #ffdad6)',
		outlineOffset: 2
	}
} as const;
const onSurfaceVariant = 'var(--m3-on-surface-variant, #444748)';

const visuallyHidden = {
	position: 'absolute',
	width: 1,
	height: 1,
	padding: 0,
	margin: -1,
	overflow: 'hidden',
	clip: 'rect(0 0 0 0)',
	whiteSpace: 'nowrap',
	border: 0
} as const;

const slotSx = {
	fontSize: 16,
	fontWeight: 600,
	lineHeight: '24px',
	letterSpacing: '0.15px',
	color: onSurface
} as const;

const oldSlotSx = {
	fontSize: 14,
	lineHeight: '20px',
	letterSpacing: '0.25px',
	color: onSurfaceVariant
} as const;

/**
 * "Mi 18. Nov 13:00–14:00": a narrow card may wrap before the times, never
 * inside "13:00–14:00".
 */
const Slot = ({ text }: { text: string }) => {
	const cut = text.lastIndexOf(' ');
	if (cut < 0) return <>{text}</>;
	return (
		<>
			{text.slice(0, cut + 1)}
			<Box component="span" sx={{ whiteSpace: 'nowrap' }}>
				{text.slice(cut + 1)}
			</Box>
		</>
	);
};

export interface AppointmentNoticeMessageProps {
	notice: AppointmentNotice;
	/** Who changed it (the counsellor); absent: not shown. */
	byName?: string;
	/** "11:17" */
	timestamp?: string;
	/** Locale for a slot carried as data; defaults to the app language. */
	locale?: string;
	actions?: AppointmentNoticeAction[];
	onCreateNew?: () => void;
	onOpenCalendar?: () => void;
}

export const AppointmentNoticeMessage = ({
	notice,
	byName,
	timestamp,
	locale,
	actions = [],
	onCreateNew,
	onOpenCalendar
}: AppointmentNoticeMessageProps) => {
	const { t, i18n } = useTranslation();
	const lang =
		locale ?? normalizeTimelineLocale(i18n.resolvedLanguage, i18n.language);
	const word = (slot: AppointmentNoticeSlot) => formatEntrySlot(slot, lang);
	const { kind } = notice;
	const slotText = 'slot' in notice ? word(notice.slot) : notice.slotText;
	const previousText =
		'slot' in notice && notice.previous ? word(notice.previous) : undefined;
	const Icon = ICON[kind];
	const title = t(`message.appointmentNotice.title.${kind}`);
	const cancelled = kind === 'cancelled';

	return (
		<ChatSystemMessageCard
			title={title}
			subtitle={
				byName
					? t('message.appointmentNotice.by', { name: byName })
					: undefined
			}
			timestamp={timestamp}
			dataCy={`appointment-notice-${kind}`}
		>
			<Stack
				component="section"
				aria-label={title}
				spacing={1.5}
				sx={{ minWidth: 0 }}
			>
				<Stack direction="row" spacing={1.5} alignItems="center">
					<Box
						data-testid={`appointment-notice-icon-${kind}`}
						sx={{
							width: 40,
							height: 40,
							borderRadius: '50%',
							display: 'grid',
							placeItems: 'center',
							flex: '0 0 auto',
							backgroundColor: TILE[kind].bg,
							color: TILE[kind].fg
						}}
					>
						<Icon fontSize="small" />
					</Box>
					<Stack sx={{ minWidth: 0 }}>
						{previousText && (
							<Typography
								component="del"
								sx={{
									...oldSlotSx,
									textDecoration: 'line-through'
								}}
								data-testid="appointment-notice-previous"
							>
								<Box component="span" sx={visuallyHidden}>
									{t('message.appointmentNotice.before')}{' '}
								</Box>
								<Slot text={previousText} />
							</Typography>
						)}
						{cancelled ? (
							<Typography
								component="del"
								sx={{
									...slotSx,
									color: onSurfaceVariant,
									textDecoration: 'line-through'
								}}
								data-testid="appointment-notice-slot"
							>
								<Slot text={slotText} />
							</Typography>
						) : (
							<Typography
								sx={slotSx}
								data-testid="appointment-notice-slot"
							>
								{previousText && (
									<Box
										component="span"
										aria-hidden
										sx={{
											mr: 0.5,
											color: onSurfaceVariant
										}}
									>
										→
									</Box>
								)}
								{previousText && (
									<Box component="span" sx={visuallyHidden}>
										{t(
											'message.appointmentNotice.after'
										)}{' '}
									</Box>
								)}
								<Slot text={slotText} />
							</Typography>
						)}
					</Stack>
				</Stack>

				{actions.length > 0 && (
					<Stack
						direction="row"
						spacing={1}
						flexWrap="wrap"
						useFlexGap
					>
						{actions.includes('createNew') && onCreateNew && (
							<Button
								variant="contained"
								disableElevation
								startIcon={<AddRoundedIcon />}
								onClick={onCreateNew}
								data-cy="appointment-notice-create"
								sx={{
									...actionSx,
									'backgroundColor': primary,
									'color': onPrimary,
									'&:hover': { backgroundColor: primary }
								}}
							>
								{t(
									'message.appointmentNotice.action.createNew'
								)}
							</Button>
						)}
						{actions.includes('openCalendar') && onOpenCalendar && (
							<Button
								variant="outlined"
								startIcon={<EventOutlinedIcon />}
								onClick={onOpenCalendar}
								data-cy="appointment-notice-calendar"
								sx={{
									...actionSx,
									borderColor: outline,
									color: primary
								}}
							>
								{t(
									'message.appointmentNotice.action.openCalendar'
								)}
							</Button>
						)}
					</Stack>
				)}
			</Stack>
		</ChatSystemMessageCard>
	);
};

/**
 * The card with what this viewer may do: "Neuen Termin anlegen" only while
 * the room lends its create dialog (its counsellor, a running conversation,
 * nothing booked yet), "Im Kalender öffnen" only with "Meine Termine".
 */
export const AppointmentNoticeCard = ({
	notice,
	sessionId,
	byName,
	timestamp,
	readOnly = false
}: {
	notice: AppointmentNotice;
	sessionId?: number;
	byName?: string;
	timestamp?: string;
	/** Previews (Timeline) draw the card without actions. */
	readOnly?: boolean;
}) => {
	const navigate = useNavigate();
	const { userData } = useContext(UserDataContext);
	const { activeSession } = useContext(ActiveSessionContext);
	const loan = useAppointmentCreate(readOnly ? undefined : sessionId);
	// Counsellors always have "Meine Termine"; an advice seeker once a
	// counsellor is assigned (RouterConfig `showAppointmentsMenuItem`).
	const hasCalendar =
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
		(hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
			Boolean(activeSession?.consultant));
	const actions = readOnly
		? []
		: appointmentNoticeActions({
				notice,
				canCreate: Boolean(loan),
				hasUpcoming: Boolean(loan?.hasUpcoming),
				canOpenCalendar: hasCalendar
			});

	return (
		<AppointmentNoticeMessage
			notice={notice}
			byName={byName}
			timestamp={timestamp}
			actions={actions}
			onCreateNew={loan?.open}
			onOpenCalendar={
				'slot' in notice
					? () =>
							navigate(
								`${CALENDAR_PATH}?date=${calendarDayParam(
									notice.slot.start
								)}`
							)
					: undefined
			}
		/>
	);
};
