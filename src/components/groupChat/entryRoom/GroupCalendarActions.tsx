import * as React from 'react';
import { Box, Button } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';

export interface GroupCalendarActionsProps {
	/** Opens the calendar choice for this date; unset once it has begun. */
	onAddThis?: (event: React.MouseEvent<HTMLElement>) => void;
	/** Opens the dates view; unset while there is no other date. */
	onMoreDates?: () => void;
	/**
	 * Beside "Beitreten" in the bar's one row. Off on a phone and in a narrow
	 * chat column, where the actions get their own row above it.
	 */
	inline: boolean;
}

/**
 * The calendar actions in the waiting room's bar (Frank, 2026-10-19: "lame
 * auf dem Desktop"). Wide: one M3 split pill beside "Beitreten" — this date
 * on the left, all dates on the right. Narrow: two quiet pills side by side
 * above it. Once the group runs only the way to the next dates is left.
 */
export const GroupCalendarActions = ({
	onAddThis,
	onMoreDates,
	inline
}: GroupCalendarActionsProps) => {
	const { t } = useTranslation();
	const addTitle = t(
		'groupChat.calendar.addThis',
		'Diesen Termin zum Kalender hinzufügen'
	);
	const datesLabel = onAddThis
		? t('groupChat.entry.allDates', 'Alle Termine')
		: t('groupChat.entry.nextDates', 'Nächste Termine');
	const both = Boolean(onAddThis && onMoreDates);

	if (!inline) {
		return (
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: both ? '1fr 1fr' : '1fr',
					gap: 1
				}}
			>
				{onAddThis && (
					<Button
						variant="outlined"
						startIcon={<EventAvailableRoundedIcon />}
						onClick={onAddThis}
						title={addTitle}
						aria-label={addTitle}
						data-testid="group-entry-calendar"
						sx={{ ...pillSx, ...assistSx }}
					>
						{t('groupChat.entry.dates.add', 'Eintragen')}
					</Button>
				)}
				{onMoreDates && (
					<Button
						variant="outlined"
						startIcon={
							onAddThis ? undefined : <CalendarMonthRoundedIcon />
						}
						endIcon={
							onAddThis ? <ArrowForwardRoundedIcon /> : undefined
						}
						onClick={onMoreDates}
						data-testid="group-entry-dates"
						sx={{ ...pillSx, ...assistSx }}
					>
						{datesLabel}
					</Button>
				)}
			</Box>
		);
	}

	/* M3 split button: two segments, a 2 px gap, the inner corners small. */
	return (
		<Box
			data-bar-side
			sx={{
				display: 'flex',
				gap: '2px',
				flex: '0 1 auto',
				minWidth: 0
			}}
		>
			{onAddThis && (
				<Button
					variant="outlined"
					startIcon={<EventAvailableRoundedIcon />}
					onClick={onAddThis}
					title={addTitle}
					aria-label={addTitle}
					data-testid="group-entry-calendar"
					sx={{
						...pillSx,
						...segmentSx,
						...(both ? innerEnd : {})
					}}
				>
					{t('groupChat.entry.addDate', 'Termin eintragen')}
				</Button>
			)}
			{onMoreDates && (
				<Button
					variant="outlined"
					startIcon={
						onAddThis ? undefined : <CalendarMonthRoundedIcon />
					}
					endIcon={
						onAddThis ? <ArrowForwardRoundedIcon /> : undefined
					}
					onClick={onMoreDates}
					data-testid="group-entry-dates"
					sx={{
						...pillSx,
						...segmentSx,
						...(both ? innerStart : {})
					}}
				>
					{datesLabel}
				</Button>
			)}
		</Box>
	);
};

/**
 * Neutral, not a second red button: dark type on a grey outline, the icon in
 * the brand colour. The theme's hover (red fill, white type) stays, so the
 * icon follows the type there.
 */
const pillSx = {
	'minWidth': 0,
	'overflow': 'hidden',
	'textOverflow': 'ellipsis',
	'whiteSpace': 'nowrap',
	'textTransform': 'none',
	'fontWeight': 600,
	'color': registrationMd3.onSurface,
	'borderColor': registrationMd3.outline,
	'& .MuiButton-startIcon': { color: registrationMd3.primary, mr: 1 },
	'& .MuiButton-endIcon': { ml: 0.75 },
	'&:hover .MuiButton-startIcon': { color: 'inherit' }
} as const;

const segmentSx = {
	flex: '0 1 auto',
	minHeight: 56,
	py: 0,
	px: 2.25,
	fontSize: 15,
	borderRadius: '28px'
} as const;

/* An M3 assist chip's size: a finger's 44 px, not the bar's 56. */
const assistSx = {
	minHeight: 44,
	py: 0,
	px: 1.5,
	fontSize: 14,
	borderRadius: '22px'
} as const;

const innerEnd = {
	borderTopRightRadius: 4,
	borderBottomRightRadius: 4
} as const;

const innerStart = {
	borderTopLeftRadius: 4,
	borderBottomLeftRadius: 4
} as const;
