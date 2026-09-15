import * as React from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useTranslation } from 'react-i18next';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { LIVE_CHAT_OPENING_HOURS } from '../liveChatOpeningHours';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface LiveChatClosedProps {
	onMailCounselling: () => void;
	/** The quiet exit — back to waiting (availability can recover). */
	onLater: () => void;
}

const DAY_ORDER = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday'
];
const DAY_SHORT: Record<string, string> = {
	monday: 'Mo',
	tuesday: 'Di',
	wednesday: 'Mi',
	thursday: 'Do',
	friday: 'Fr',
	saturday: 'Sa',
	sunday: 'So'
};

/**
 * C — closed. Centred, the week as a strip (open days with their hours,
 * closed days grey), one sentence, and the written request as the way on.
 * Hours come from `LIVE_CHAT_OPENING_HOURS`, the same source the old modal
 * used, so the two never disagree.
 */
export const LiveChatClosed = ({
	onMailCounselling,
	onLater
}: LiveChatClosedProps) => {
	const { t } = useTranslation();
	const tr = (key: string, fallback: string) =>
		translateWithFallback(t, `liveChat.entry.closed.${key}`, fallback);
	const narrow = useMediaQuery('(max-width:599px)');
	const week = DAY_ORDER.map((dayKey) => ({
		short: t(`weekday.${dayKey}Short`, DAY_SHORT[dayKey]),
		hours: LIVE_CHAT_OPENING_HOURS.filter((h) => h.dayKey === dayKey)
			.map((h) => h.time.replace(/\s*-\s*/, '–'))
			.join(' · ')
	}));
	return (
		<>
			<Box
				sx={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					textAlign: 'center',
					maxWidth: 560,
					mx: 'auto'
				}}
			>
				<Box
					aria-hidden
					sx={{
						'width': 72,
						'height': 72,
						'borderRadius': '50%',
						'bgcolor': registrationMd3.surfaceContainer,
						'color': registrationMd3.primary,
						'display': 'flex',
						'alignItems': 'center',
						'justifyContent': 'center',
						'mb': 2.5,
						'& svg': { fontSize: 36 }
					}}
				>
					<ScheduleOutlinedIcon />
				</Box>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 28, sm: 32 },
						lineHeight: 1.15,
						fontWeight: 700
					}}
				>
					{tr('headline', 'Der Live-Chat ist gerade geschlossen.')}
				</Typography>
				<Box
					role="list"
					aria-label={tr('hoursLabel', 'Öffnungszeiten')}
					sx={{
						display: 'flex',
						gap: { xs: 0.5, sm: 1 },
						mt: 3,
						width: '100%',
						justifyContent: 'center'
					}}
				>
					{week.map((day) => (
						<Box
							key={day.short}
							role="listitem"
							sx={{
								flex: { xs: '1 1 0', sm: '0 0 60px' },
								minWidth: 0,
								py: 1.25,
								borderRadius: '14px',
								bgcolor: day.hours
									? registrationMd3.selectedLayer
									: registrationMd3.surfaceContainer,
								color: day.hours
									? registrationMd3.primary
									: registrationMd3.onSurfaceVariant
							}}
						>
							<Typography sx={{ fontSize: 13, fontWeight: 700 }}>
								{day.short}
							</Typography>
							<Typography
								sx={{
									fontSize: 11,
									mt: 0.25,
									whiteSpace: 'pre-line'
								}}
							>
								{day.hours ? (
									day.hours.split(' · ').join('\n')
								) : (
									<>
										<span aria-hidden="true">—</span>
										<span className="sr-only">
											{tr('closedDay', 'geschlossen')}
										</span>
									</>
								)}
							</Typography>
						</Box>
					))}
				</Box>
				<Typography
					sx={{
						mt: 3,
						fontSize: 15,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{narrow
						? tr(
								'textShort',
								'Schreiben Sie uns — Antwort in zwei Arbeitstagen.'
							)
						: tr(
								'text',
								'Gerade ist niemand im Live-Chat. Schreiben Sie uns — wir antworten innerhalb von zwei Arbeitstagen.'
							)}
				</Typography>
			</Box>
			<RegistrationFooter
				secondary={{
					label: tr('later', 'Später'),
					compact: true,
					round: narrow,
					onClick: onLater
				}}
				primary={{
					label: narrow
						? tr('mailShort', 'Anfrage schreiben')
						: tr(
								'mail',
								'Anfrage an eine Beratungsstelle schreiben'
							),
					onClick: onMailCounselling
				}}
			/>
		</>
	);
};
