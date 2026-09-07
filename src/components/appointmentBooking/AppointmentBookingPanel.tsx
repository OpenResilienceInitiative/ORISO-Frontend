import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { OrisoCalendar } from '../form/OrisoCalendar';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { orisoDateTimeColors } from '../form/orisoDateTimeDesign';
import { translateWithFallback } from '../../utils/translationFallback';

/** How long the panel takes to slide in or out. Mirrored in the keyframes.
    Same number as `GroupInfoGallery`: the two slide-ins are one family. */
const SLIDE_MS = 320;

const reducedMotion = () =>
	typeof window.matchMedia !== 'function' ||
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The times offered while no backend says otherwise.
 *
 * PROVISIONAL — real availability comes from the counselling agency's calendar
 * (the booking service already knows it; see `booking.availability` in the
 * counsellor's profile). Until that endpoint is wired in, the panel shows a
 * fixed working-day grid and no times at all on Saturday and Sunday. No URL is
 * invented here: whoever mounts the panel passes `slotsForDay` the moment there
 * is something real to pass.
 */
export const defaultSlotsForDay = (day: Dayjs): string[] => {
	const weekday = day.day();
	if (weekday === 0 || weekday === 6) {
		return [];
	}
	return ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
};

export interface AppointmentBookingPanelProps {
	/** Back to whatever opened the panel. Called once the slide-back played. */
	onBack: () => void;
	/** The chosen day and time, as one ISO 8601 value with the local offset. */
	onConfirm: (isoDateTime: string) => void;
	/** Which times a day offers. Defaults to the provisional grid above. */
	slotsForDay?: (day: Dayjs) => string[];
	/** The booking is on its way out; the primary action waits. */
	busy?: boolean;
	/** Names where the back control goes, when it is not the waiting room. */
	backLabel?: string;
}

/**
 * "Termin buchen" — the month calendar Frank asked for instead of a login
 * field (2026-09-07: "Da sollte wahrscheinlich eher ein Kalender sein und man
 * sollte erst einen Kalender buchen … die Monatsansicht deines Kalenders …
 * zum hin und her klicken").
 *
 * A pure view: no routing, no API, no date library of its own. The month grid
 * is `OrisoCalendar`, the design system's calendar built from the Figma — this
 * panel only adds the times under it and the primary action.
 *
 * It comes in from the right edge and moves left into place, and it leaves the
 * same way it came, exactly like `GroupInfoGallery`; `prefers-reduced-motion`
 * gets neither, the panel is simply there and simply gone.
 */
export const AppointmentBookingPanel = ({
	onBack,
	onConfirm,
	slotsForDay = defaultSlotsForDay,
	busy = false,
	backLabel
}: AppointmentBookingPanelProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `booking.appointment.${key}`, fallback),
		[t]
	);
	/* Nothing in the past can be booked; the month before today stays
	   reachable, its days do not. */
	const notBefore = useMemo(() => dayjs().startOf('day'), []);
	const [day, setDay] = useState<Dayjs | null>(null);
	const [time, setTime] = useState<string | null>(null);
	const [leaving, setLeaving] = useState(false);
	/* The slide-out may end twice (animationend and the timer); the screen
	   behind must come back once. */
	const done = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const finish = useCallback(() => {
		if (done.current) {
			return;
		}
		done.current = true;
		onBack();
	}, [onBack]);

	const requestBack = useCallback(() => {
		if (done.current || leaving) {
			return;
		}
		if (reducedMotion()) {
			finish();
			return;
		}
		setLeaving(true);
		/* jsdom and any browser that drops the animation never fire
		   `animationend`; the timer is what guarantees the way back. */
		timer.current = setTimeout(finish, SLIDE_MS);
	}, [finish, leaving]);

	useEffect(() => () => clearTimeout(timer.current), []);

	/* Escape closes the panel like any other overlay. */
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				requestBack();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [requestBack]);

	/* Booking is a step, not a page: a marker entry makes the browser's back
	   button (and the phone's back gesture) mean "back to where I came from"
	   instead of "leave". Popped again on the way out so the history does not
	   grow with every look at the calendar. */
	const finishRef = useRef(finish);
	finishRef.current = finish;
	useEffect(() => {
		window.history.pushState({ appointmentBooking: true }, '');
		const onPopState = () => finishRef.current();
		window.addEventListener('popstate', onPopState);
		return () => {
			window.removeEventListener('popstate', onPopState);
			if (window.history.state?.appointmentBooking) {
				window.history.back();
			}
		};
	}, []);

	const back = backLabel ?? tr('back', 'Zurück zum Warteraum');
	/* One key, seven languages: the calendar wants single letters starting on
	   Sunday, and every language spells them differently. */
	const dayLabels = tr('weekdays', 'S,M,D,M,D,F,S').split(',');
	const slots = day ? slotsForDay(day) : [];

	const selectDay = (next: Dayjs) => {
		setDay(next);
		/* A time only means something together with its day — another day may
		   not offer it at all. */
		setTime(null);
	};

	const confirm = () => {
		if (!day || !time) {
			return;
		}
		const [hour, minute] = time.split(':').map(Number);
		onConfirm(
			day.hour(hour).minute(minute).second(0).millisecond(0).format()
		);
	};

	return (
		<Box
			data-cy="appointment-booking-panel"
			sx={{
				// Clips its own child while that child sits off to the right,
				// so the slide never adds a horizontal scrollbar to the page.
				overflow: 'hidden',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				minHeight: 0
			}}
		>
			<Box
				onAnimationEnd={leaving ? finish : undefined}
				sx={{
					'display': 'flex',
					'flexDirection': 'column',
					'flex': 1,
					'minHeight': 0,
					'animation': `${
						leaving
							? 'appointmentBookingOut'
							: 'appointmentBookingIn'
					} ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) both`,
					'@keyframes appointmentBookingIn': {
						from: { transform: 'translateX(100%)', opacity: 0 },
						to: { transform: 'translateX(0)', opacity: 1 }
					},
					'@keyframes appointmentBookingOut': {
						from: { transform: 'translateX(0)', opacity: 1 },
						to: { transform: 'translateX(100%)', opacity: 0 }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1,
						mb: { xs: 1.5, sm: 2 }
					}}
				>
					<IconButton
						onClick={requestBack}
						data-testid="appointment-booking-back"
						aria-label={back}
						size="small"
						sx={{ color: registrationMd3.onSurfaceVariant }}
					>
						<ArrowBackRoundedIcon />
					</IconButton>
					<Typography
						sx={{
							fontSize: 14,
							fontWeight: 600,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{back}
					</Typography>
				</Box>

				<Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
					<Typography
						component="h1"
						sx={{
							fontSize: { xs: 26, sm: 32 },
							lineHeight: { xs: '32px', sm: '38px' },
							fontWeight: 700,
							color: registrationMd3.onSurface
						}}
					>
						{tr('headline', 'Termin buchen')}
					</Typography>
					<Typography
						sx={{
							mt: 1,
							fontSize: 16,
							color: registrationMd3.onSurfaceVariant
						}}
					>
						{tr(
							'subline',
							'Wählen Sie einen Tag und danach eine Uhrzeit.'
						)}
					</Typography>
				</Box>

				<Box
					sx={{
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
						alignItems: { xs: 'center', md: 'flex-start' },
						gap: { xs: 2, sm: 2.5 }
					}}
				>
					{/* The design system's month grid, not a second calendar:
					    days, months and years, both dropdowns, the Figma's
					    docked container. It may shrink below its 328 px on a
					    375 pt phone — the cells inside need 304. */}
					<Box
						sx={{
							'maxWidth': '100%',
							'& > *': { maxWidth: '100%' }
						}}
					>
						<OrisoCalendar
							value={day}
							onChange={selectDay}
							minDate={notBefore}
							weekStart={1}
							dayLabels={dayLabels}
						/>
					</Box>

					<Box sx={{ width: '100%', minWidth: 0 }}>
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
								{slots.map((slot) => (
									<Button
										key={slot}
										variant={
											slot === time
												? 'contained'
												: 'outlined'
										}
										size="small"
										aria-pressed={slot === time}
										onClick={() => setTime(slot)}
										data-testid={`appointment-booking-slot-${slot}`}
										sx={slotButtonSx}
									>
										{slot}
									</Button>
								))}
							</Box>
						)}
					</Box>
				</Box>

				<Box sx={{ mt: { xs: 2, sm: 2.5 } }}>
					<Button
						variant="contained"
						onClick={confirm}
						disabled={!day || !time || busy}
						data-testid="appointment-booking-confirm"
					>
						{tr('confirm', 'Termin buchen')}
					</Button>
				</Box>
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
