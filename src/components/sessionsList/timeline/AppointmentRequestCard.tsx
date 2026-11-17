/**
 * A requested appointment below the room header (ORISO-Frontend#2287): the
 * advice seeker asked for a time the counsellor has to confirm. The
 * counsellor confirms or declines it here; the advice seeker sees that it
 * waits for confirmation. Only the session's counsellor gets the actions,
 * and the backend enforces the same.
 */
import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import { useTranslation } from 'react-i18next';
import { normalizeTimelineLocale } from '../futureTimelineTime';
import { formatEntrySlot } from './timelineModel';

export interface AppointmentRequestCardProps {
	start: Date;
	end?: Date;
	role: 'asker' | 'counsellor';
	/** A decision is on its way: both actions wait. */
	busy?: boolean;
	/** Why the last decision failed, already translated. */
	error?: string;
	onConfirm?: () => void;
	onDecline?: () => void;
}

export const AppointmentRequestCard = ({
	start,
	end,
	role,
	busy = false,
	error,
	onConfirm,
	onDecline
}: AppointmentRequestCardProps) => {
	const { t, i18n } = useTranslation();
	const date = formatEntrySlot(
		{ start, end },
		normalizeTimelineLocale(i18n.resolvedLanguage, i18n.language)
	);
	/* Actions only where someone may decide: the session's counsellor. */
	const counsellor = role === 'counsellor' && !!onConfirm && !!onDecline;
	return (
		<Box
			data-testid="appointment-request-card"
			data-role={role}
			role="group"
			aria-label={t('sessionList.timeline.appointment.request.title')}
			sx={{
				display: 'flex',
				flexWrap: 'wrap',
				alignItems: 'center',
				gap: 1,
				px: 1.5,
				py: 1,
				border: '1px dashed var(--m3-outline, #79747e)',
				borderRadius: '12px',
				maxWidth: '100%'
			}}
		>
			<HourglassEmptyOutlinedIcon fontSize="small" aria-hidden />
			<Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					{t('sessionList.timeline.appointment.request.title')}
				</Typography>
				<Typography variant="body2">{date}</Typography>
				{!counsellor && (
					<Typography
						variant="body2"
						sx={{ color: 'var(--m3-on-surface-variant, #49454f)' }}
					>
						{t('sessionList.timeline.appointment.request.waiting')}
					</Typography>
				)}
				{error && (
					<Typography
						variant="body2"
						role="alert"
						sx={{ color: 'var(--m3-error, #b3261e)' }}
					>
						{error}
					</Typography>
				)}
			</Box>
			{counsellor && (
				<Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
					<Button
						data-testid="appointment-request-decline"
						variant="outlined"
						size="small"
						disabled={busy}
						onClick={onDecline}
					>
						{t('sessionList.timeline.appointment.request.decline')}
					</Button>
					<Button
						data-testid="appointment-request-confirm"
						variant="contained"
						size="small"
						disabled={busy}
						onClick={onConfirm}
					>
						{t('sessionList.timeline.appointment.request.confirm')}
					</Button>
				</Box>
			)}
		</Box>
	);
};
