import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';
import { GroupChatCalendarPopover } from '../GroupChatCalendarMenu';
import { EntryRoomPanel } from './EntryRoomPanel';

export interface GroupUpcomingDatesProps {
	/** Back to the waiting room. Called once the slide-back has played. */
	onBack: () => void;
	/** The dates still ahead, soonest first. */
	dates: Date[];
	durationMinutes: number;
	/** The chat id; the calendar event's UID adds the date to it. */
	eventId: string | number;
}

/**
 * "Nächste Termine" — the group's dates still ahead, each one for the
 * calendar on its own (Frank, 2026-10-19). Opened from the bar's "Weitere
 * Termine"; it takes the waiting room's middle like "Mehr erfahren" does, and
 * "Beitreten" stays in the bar below it.
 */
export const GroupUpcomingDates = ({
	onBack,
	dates,
	durationMinutes,
	eventId
}: GroupUpcomingDatesProps) => {
	const { t, i18n } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.entry.dates.${key}`, fallback),
		[t]
	);
	/* The dates follow the language the person reads, not the browser's.
	   The informal variants are i18next tags, not BCP-47: `Intl` throws
	   RangeError on 'de@informal'. */
	const locale = (i18n?.resolvedLanguage || i18n?.language || 'de').split(
		'@'
	)[0];
	const dayFormat = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				day: '2-digit',
				month: '2-digit'
			}),
		[locale]
	);
	const timeFormat = useMemo(
		() =>
			new Intl.DateTimeFormat(locale, {
				hour: '2-digit',
				minute: '2-digit'
			}),
		[locale]
	);
	const [open, setOpen] = useState<{
		anchor: HTMLElement;
		date: Date;
	} | null>(null);

	return (
		<EntryRoomPanel
			onBack={onBack}
			backLabel={t('groupChat.info.gallery.back', 'Zurück zum Countdown')}
			backTestId="group-dates-back"
			dataCy="group-upcoming-dates"
		>
			<Box sx={{ mb: { xs: 2, sm: 3 } }}>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 26, sm: 32 },
						lineHeight: { xs: '32px', sm: '38px' },
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{tr('headline', 'Nächste Termine')}
				</Typography>
				<Typography
					sx={{
						mt: 1,
						fontSize: 16,
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{dates.length
						? tr(
								'subline',
								'Tragen Sie jeden Termin einzeln in Ihren Kalender ein.'
							)
						: tr(
								'none',
								'Zurzeit sind keine weiteren Termine geplant.'
							)}
				</Typography>
			</Box>
			<Box
				component="ul"
				sx={{
					listStyle: 'none',
					m: 0,
					p: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 1
				}}
			>
				{dates.map((date) => {
					const end = new Date(
						date.getTime() + durationMinutes * 60e3
					);
					const day = dayFormat.format(date);
					const time = `${timeFormat.format(date)} – ${timeFormat.format(
						end
					)}`;
					const when = `${day}, ${time}`;
					return (
						<Box
							component="li"
							key={date.toISOString()}
							data-cy="group-upcoming-date"
							sx={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: 1.5,
								minHeight: 56,
								px: 2,
								py: 1,
								border: `1px solid ${registrationMd3.outlineVariant}`,
								borderRadius: '12px'
							}}
						>
							<Typography
								sx={{
									fontSize: 16,
									fontWeight: 500,
									color: registrationMd3.onSurface,
									minWidth: 0
								}}
							>
								{day},{' '}
								{/* A narrow row breaks after the day, never
								    inside the time span. */}
								<Box
									component="span"
									sx={{ whiteSpace: 'nowrap' }}
								>
									{time}
								</Box>
							</Typography>
							<Button
								variant="outlined"
								size="small"
								startIcon={<CalendarMonthRoundedIcon />}
								aria-label={t(
									'groupChat.entry.dates.addLabel',
									{
										date: when,
										defaultValue:
											'{{date}} zum Kalender hinzufügen'
									}
								)}
								onClick={(event) =>
									setOpen({
										anchor: event.currentTarget,
										date
									})
								}
								data-testid="group-upcoming-date-add"
								sx={{
									'flexShrink': 0,
									'minHeight': 36,
									'py': 0.5,
									'px': 1.5,
									'fontSize': 13,
									'textTransform': 'none',
									'& .MuiButton-startIcon': { mr: 0.5 }
								}}
							>
								{tr('add', 'Eintragen')}
							</Button>
						</Box>
					);
				})}
			</Box>
			{open && (
				<GroupChatCalendarPopover
					anchorEl={open.anchor}
					onClose={() => setOpen(null)}
					start={open.date}
					durationMinutes={durationMinutes}
					eventId={eventId}
				/>
			)}
		</EntryRoomPanel>
	);
};
