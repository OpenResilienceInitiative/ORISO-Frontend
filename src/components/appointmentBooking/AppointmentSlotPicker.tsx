import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { orisoDateTimeColors } from '../form/orisoDateTimeDesign';
import { translateWithFallback } from '../../utils/translationFallback';

export interface AppointmentSlotPickerProps {
	day: Dayjs | null;
	time: string | null;
	onDayChange: (day: Dayjs) => void;
	onTimeChange: (time: string) => void;
	/** Which times (HH:mm, local) a day offers. */
	slotsForDay: (day: Dayjs) => string[];
	/**
	 * FE#2287: which of those times are requests the counsellor confirms;
	 * the others are booked at once. Without it every time is booked at once
	 * and nothing is marked.
	 */
	requestTimesForDay?: (day: Dayjs) => string[];
	/** The last day that can offer anything. */
	maxDate?: Dayjs;
	/**
	 * Side by side from the `md` viewport on (the waiting room's full
	 * page), or wrapping by the room the container has (a dialog).
	 */
	layout?: 'page' | 'container';
}

/**
 * The month grid and the free times of the chosen day — the part of "Termin
 * buchen" the waiting room's panel and the advice seeker's call dialog
 * share (FE#1050). The month grid is `OrisoCalendar`, the design system's
 * calendar; this only adds the times next to it.
 */
export const AppointmentSlotPicker = ({
	day,
	time,
	onDayChange,
	onTimeChange,
	slotsForDay,
	requestTimesForDay,
	maxDate,
	layout = 'page'
}: AppointmentSlotPickerProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `booking.appointment.${key}`, fallback),
		[t]
	);
	/* Nothing in the past can be booked; the month before today stays
	   reachable, its days do not. */
	const notBefore = useMemo(() => dayjs().startOf('day'), []);
	/* One key, seven languages: the calendar wants single letters starting on
	   Sunday, and every language spells them differently. */
	const dayLabels = tr('weekdays', 'S,M,D,M,D,F,S').split(',');
	/* Today is bookable, but the hours that have gone are not: `notBefore`
	   compares calendar days, so without this the grid still offered 09:00 at
	   half past four and `confirm` handed a past ISO datetime on. */
	const slots = useMemo(() => {
		if (!day) {
			return [];
		}
		const offered = slotsForDay(day);
		const now = dayjs();
		if (!day.isSame(now, 'day')) {
			return offered;
		}
		return offered.filter((slot) => {
			const [hour, minute] = slot.split(':').map(Number);
			return day
				.hour(hour)
				.minute(minute)
				.second(0)
				.millisecond(0)
				.isAfter(now);
		});
	}, [day, slotsForDay]);

	const requests = useMemo(
		() => new Set(day && requestTimesForDay ? requestTimesForDay(day) : []),
		[day, requestTimesForDay]
	);
	const marked = requests.size > 0;
	const requestLabel = tr('requestTime', 'Anfrage');

	const page = layout === 'page';

	return (
		<Box
			sx={{
				display: 'flex',
				/* Side by side once there is room: the calendar keeps its own
				   width and the times fill the space next to it, instead of
				   leaving that half of the screen empty and pushing the times
				   below the fold (Frank, 2026-09-07). */
				flexDirection: page ? { xs: 'column', md: 'row' } : 'row',
				flexWrap: page ? 'nowrap' : 'wrap',
				alignItems: page
					? { xs: 'center', md: 'flex-start' }
					: 'flex-start',
				justifyContent: page ? undefined : 'center',
				gap: page ? { xs: 2, sm: 2.5, md: 4 } : 3
			}}
		>
			{/* It may shrink below its 328 px on a 375 pt phone — the cells
			    inside need 304. */}
			<Box
				sx={{
					'maxWidth': '100%',
					'flex': 'none',
					'& > *': { maxWidth: '100%' }
				}}
			>
				<OrisoCalendar
					value={day}
					onChange={onDayChange}
					minDate={notBefore}
					maxDate={maxDate}
					weekStart={1}
					dayLabels={dayLabels}
				/>
			</Box>

			<Box
				sx={{
					width: page ? '100%' : undefined,
					flex: page ? undefined : '1 1 240px',
					minWidth: 0
				}}
			>
				<Typography
					component="h2"
					sx={{
						fontSize: 14,
						fontWeight: 600,
						color: registrationMd3.onSurface,
						mb: 1
					}}
				>
					{tr('times', 'Freie Zeiten')}
					{day ? ` — ${day.format('DD.MM.YYYY')}` : ''}
				</Typography>
				{!day && (
					<Typography
						data-testid="appointment-booking-hint"
						sx={{
							fontSize: 14,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{tr(
							'pickDay',
							'Bitte wählen Sie zuerst einen Tag im Kalender.'
						)}
					</Typography>
				)}
				{day && slots.length === 0 && (
					<Typography
						data-testid="appointment-booking-empty"
						sx={{
							fontSize: 14,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{tr(
							'noTimes',
							'An diesem Tag ist keine Zeit frei. Bitte wählen Sie einen anderen Tag.'
						)}
					</Typography>
				)}
				{day && slots.length > 0 && (
					<Box
						role="group"
						aria-label={tr('times', 'Freie Zeiten')}
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: 1
						}}
					>
						{slots.map((slot) => {
							const request = requests.has(slot);
							return (
								<Button
									key={slot}
									variant={
										slot === time ? 'contained' : 'outlined'
									}
									size="small"
									aria-pressed={slot === time}
									aria-label={
										request
											? `${slot}, ${requestLabel}`
											: undefined
									}
									onClick={() => onTimeChange(slot)}
									data-testid={`appointment-booking-slot-${slot}`}
									data-booking-mode={
										requestTimesForDay
											? request
												? 'REQUEST'
												: 'INSTANT'
											: undefined
									}
									startIcon={
										request ? (
											<HourglassEmptyOutlinedIcon
												aria-hidden="true"
												fontSize="small"
											/>
										) : undefined
									}
									sx={request ? requestSlotSx : slotButtonSx}
								>
									{slot}
								</Button>
							);
						})}
					</Box>
				)}
				{/* FE#2287: what the two kinds of time mean, under the times. */}
				{day && slots.length > 0 && marked && (
					<Box
						component="ul"
						data-testid="appointment-booking-legend"
						sx={legendSx}
					>
						<li data-booking-mode="INSTANT">
							<EventAvailableOutlinedIcon
								aria-hidden="true"
								fontSize="small"
							/>
							{tr('legendInstant', 'Sofort gebucht')}
						</li>
						<li data-booking-mode="REQUEST">
							<HourglassEmptyOutlinedIcon
								aria-hidden="true"
								fontSize="small"
							/>
							{tr(
								'legendRequest',
								'Anfrage – Ihre Beratungsperson bestätigt den Termin'
							)}
						</li>
					</Box>
				)}
			</Box>
		</Box>
	);
};

/**
 * A time is a chip, not a form button: the theme pads an outlined button to
 * 50 px, which turns six times into a wall. 40 px is the M3 chip height and
 * still a finger's target.
 */
const slotButtonSx = {
	'minHeight': 40,
	'minWidth': 84,
	'py': 0,
	'px': 1.75,
	'fontSize': 14,
	'lineHeight': '20px',
	'borderRadius': '20px',
	'&.MuiButton-outlined': {
		borderColor: orisoDateTimeColors.outline,
		color: orisoDateTimeColors.onSurface
	}
} as const;

/**
 * FE#2287: a time the counsellor still confirms. Dashed outline and an
 * hourglass, so the difference does not rest on colour alone.
 */
const requestSlotSx = {
	...slotButtonSx,
	'&.MuiButton-outlined': {
		borderColor: orisoDateTimeColors.outline,
		borderStyle: 'dashed',
		color: orisoDateTimeColors.onSurface
	},
	'& .MuiButton-startIcon': { mr: 0.5, ml: -0.5 }
} as const;

const legendSx = {
	'listStyle': 'none',
	'm': 0,
	'mt': 1.5,
	'p': 0,
	'display': 'flex',
	'flexDirection': 'column',
	'gap': 0.5,
	'fontSize': 13,
	'lineHeight': '18px',
	'color': registrationMd3.onSurfaceVariant,
	'& li': { display: 'flex', alignItems: 'center', gap: 0.75 },
	'& svg': { fontSize: 18 }
} as const;
