import * as React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from 'react-i18next';
import { Switch } from '../../Switch';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { WaitingAreaCountdown } from '../waitingClock/WaitingAreaCountdown';
import { WaitingAreaRules } from '../WaitingAreaRules';
import { GroupChatCalendarPopover } from '../GroupChatCalendarMenu';
import { GroupInfoGallery } from './GroupInfoGallery';
import { AppointmentBookingPanel } from '../../appointmentBooking/AppointmentBookingPanel';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { StageLayout } from '../../stageLayout/StageLayout';
import { Stage } from '../../stage/stage';
import { translateWithFallback } from '../../../utils/translationFallback';

export interface GroupWaitingRoomProps {
	/** The group's topic, shown small above the name. */
	topicName?: string;
	/** Who runs the group — the agency the chat is assigned to. */
	agencyName?: string;
	/** When the group starts; `null` for a group without a fixed time. */
	plannedStart: Date | null;
	durationMinutes?: number;
	/** The chat id, only used to key the calendar event. */
	eventId: string | number;
	welcomeText?: string;
	rules: string[];
	/** The moderator has opened the chat — joining is possible now. */
	active: boolean;
	onJoin: () => void;
	joinBusy?: boolean;
	/** A fixed "now" for stories and tests; the app leaves it unset. */
	nowMs?: number;
	/** Where "Einloggen" in the header goes. Off for someone already in. */
	showLoginLink?: boolean;
}

/**
 * The self-help group's waiting room on the stage: the clock as large as the
 * white column allows, topic and agency in the stage header, the animation
 * switch and "Mehr erfahren" above the bar but not on it, calendar and
 * "Beitreten" in the bar. Frank, 2026-09-04/05: the Figma with the clock as
 * one grid; "maximal groß im weißen Bereich"; "unten, aber nicht Teil des
 * Footers".
 *
 * This is the view; `GroupEntryRoom` feeds it from the chat and does the
 * joining. Storybook renders it with fixtures.
 */
export const GroupWaitingRoom = ({
	topicName,
	agencyName,
	plannedStart,
	durationMinutes = 60,
	eventId,
	welcomeText,
	rules,
	active,
	onJoin,
	joinBusy = false,
	nowMs,
	showLoginLink = false
}: GroupWaitingRoomProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.entry.${key}`, fallback),
		[t]
	);
	const [motionOff, setMotionOff] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const [bookingOpen, setBookingOpen] = useState(false);
	const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(
		null
	);
	const clockHeight = useClockHeight();
	const narrow = useMediaQuery('(max-width:1199px)');
	const menuId = `${useId().replace(/:/g, '')}-entry-calendar`;

	/*
	 * Topic and agency are two lines, never one joined sentence: both come
	 * from the API and an em dash glued between them reads as part of the
	 * agency's name the moment one of the two is missing or already carries
	 * punctuation (Frank, 2026-09-07: "diese Bindestriche musst du dann hart
	 * reincoden … da werden ja Daten dynamisch geladen").
	 *
	 * The line height is the tight one: at 11 and 14 px the inherited 24 px
	 * leading spends 48 px on two short lines, which is the "so viel Space
	 * für Überschriften" Frank saw on the phone.
	 */
	const groupHeading = (
		<Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
			{topicName && (
				<Typography
					sx={{
						fontSize: 11,
						lineHeight: 1.35,
						fontWeight: 600,
						letterSpacing: '.12em',
						textTransform: 'uppercase',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{topicName}
				</Typography>
			)}
			{agencyName && (
				<Typography
					sx={{
						fontSize: 14,
						lineHeight: 1.35,
						fontWeight: 600,
						color: registrationMd3.onSurface
					}}
				>
					{agencyName}
				</Typography>
			)}
		</Box>
	);

	const joinLabel = tr('join', 'Beitreten');
	const calendarLabel = t(
		'groupChat.calendar.add',
		'Zum Kalender hinzufügen'
	);
	const openCalendar = (event: React.MouseEvent<HTMLElement>) =>
		setCalendarAnchor(event.currentTarget);
	const joinAction = {
		label: joinLabel,
		onClick: onJoin,
		disabled: !active || joinBusy,
		testId: 'group-entry-join'
	};
	const calendarAction = plannedStart
		? {
				label: calendarLabel,
				onClick: openCalendar,
				testId: 'group-entry-calendar'
			}
		: undefined;

	/*
	 * `.stageLayout` asks for `min-height: 100%`, which resolves against a
	 * parent *height* — and this one only had a minimum, so the layout was as
	 * tall as its content and stopped ~30 px above the fold. Stretching it as a
	 * flex item gives the column below a bottom edge that really is the bottom
	 * of the window, which is what the switch row's distance to the bar is
	 * measured from.
	 */
	return (
		<Box
			sx={{
				'minHeight': '100vh',
				'display': 'flex',
				'flexDirection': 'column',
				'& > .stageLayout': { flex: 1 }
			}}
			data-cy="group-entry-room"
		>
			<StageLayout
				className="stageLayout--registration"
				showLegalLinks={true}
				showLoginLink={showLoginLink}
				showRegistrationLink={false}
				stage={<Stage hasAnimation={false} />}
				mobileHero="bar"
				headerStart={groupHeading}
			>
				<Box
					sx={{
						'width': '100%',
						'minWidth': 0,
						'maxWidth': '100%',
						/* Fill the column the stage gives us, so the bottom
						   padding below really is the distance to the bar and
						   not the distance to an arbitrary stopping point.
						   The minimum is what pins that bottom edge where the
						   stage prints something under the column: window
						   minus the head above it and the legal row below.
						   Its third band is new — between 900 and 1200 the
						   mobile head is still on *and* the legal row is
						   already there, and the old two bands were 18 px
						   short of that, which is what the scrollbar was. */
						'flexGrow': 1,
						'minHeight': {
							xs: 'calc(100vh - 96px)',
							lg: 'calc(100vh - 128px)'
						},
						'display': 'flex',
						'flexDirection': 'column',
						'justifyContent': 'center',
						/* The bar's own inset, so the switch below lines up
						   with the left edge of "Beitreten" and "Mehr erfahren"
						   with its right edge. */
						...barInsetSx,
						'pt': 1,
						/* Park the last row 12 px above the bar's hairline
						   (Frank, 2026-09-07: "wenn du die … 12 Pixel von der
						   Futter-Trennlinie") — the bar is 81 px high until
						   `sm`, 96 px from there up.

						   From 900 px the stage prints its legal links under
						   this column, so part of the reserve already sits
						   below it: 48 px while the mobile head is still on
						   (the row wraps), 32 px once the stage splits.

						   The odd one out is written as a raw range and not as
						   a second `@media (min-width:1200px)` key: that key
						   already exists here, generated from `lg` above, and
						   a hand-written twin replaces it instead of merging
						   into it — which silently took the inset with it. */
						'pb': {
							xs: 'calc(93px + env(safe-area-inset-bottom))',
							sm: '108px',
							lg: '76px'
						},
						'@media (min-width:900px) and (max-width:1199px)': {
							minHeight: 'calc(100vh - 114px)',
							pb: '60px'
						}
					}}
				>
					{/* Only the middle changes: "Mehr erfahren" replaces the clock
					    with the explainer and slides it in from the right, the
					    stage, the header and the bar stay where they are (Frank,
					    2026-09-07: "nur den Mittelteil bei den Selbsthilfegruppen
					    abzuändern", "und auch ein Backbutton wieder haben"). */}
					{bookingOpen ? (
						/* No endpoint is invented here: the panel is a view, and
						   the confirmed slot only closes it until the booking
						   service is wired in. */
						<AppointmentBookingPanel
							onBack={() => setBookingOpen(false)}
							onConfirm={() => setBookingOpen(false)}
							/* Both panels leave the same room, so they name it
							   the same way (Frank, 2026-09-07: "zurück zum
							   Countdown"). */
							backLabel={tr(
								'backToCountdown',
								'Zurück zum Countdown'
							)}
						/>
					) : moreOpen ? (
						<GroupInfoGallery onBack={() => setMoreOpen(false)} />
					) : (
						<>
							<Box
								sx={{
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'center',
									gap: 0.75
								}}
							>
								<Box
									sx={{
										display: { xs: 'block', lg: 'none' }
									}}
								>
									{groupHeading}
								</Box>
								{plannedStart ? (
									/* The clock is a picture, not a text line: on a
							   phone it may use half of the column's inset,
							   which is one mini-clock step of extra diameter
							   (the width, not the height, is what limits it
							   there). */
									<Box
										sx={{
											mx: { xs: -1, sm: 0 },
											minWidth: 0
										}}
									>
										<WaitingAreaCountdown
											plannedStart={plannedStart}
											welcomeText={welcomeText}
											rules={rules}
											nowMs={nowMs}
											clockSize="fit"
											fitHeight={clockHeight}
											spacing="tight"
											labelsOutside
											reducedMotion={motionOff}
											hideMotionToggle
											gap={8}
										/>
									</Box>
								) : (
									<Box sx={{ textAlign: 'center' }}>
										<Typography
											component="h1"
											sx={{
												fontSize: { xs: 22, sm: 26 },
												fontWeight: 600,
												color: registrationMd3.onSurface,
												mb: 1
											}}
										>
											{active
												? tr(
														'openHeadline',
														'Die Gruppe hat begonnen.'
													)
												: tr(
														'noTimeHeadline',
														'Die Gruppe beginnt, sobald die Moderation sie öffnet.'
													)}
										</Typography>
										{welcomeText && (
											<Typography
												sx={{
													color: registrationMd3.onSurfaceVariant,
													mb: 2
												}}
											>
												{welcomeText}
											</Typography>
										)}
										{rules.length > 0 && (
											<WaitingAreaRules
												rules={rules}
												ariaLabel={t(
													'groupChat.join.waitingArea.rulesLabel',
													'Chat rules'
												)}
											/>
										)}
									</Box>
								)}
							</Box>
							{/* One block with the bar, not a stranded row: same inset
					    as the buttons (from the column above), 12 px of air to
					    the hairline (from the column's bottom padding) and
					    exactly the height of the larger of its two controls. */}
							<Box
								sx={{
									mt: 'auto',
									minHeight: 44,
									display: 'flex',
									/* Three controls do not fit one 343 px line,
									   and a switch without its sentence is a
									   riddle. So the row wraps on a phone: the
									   switch keeps its label, the two buttons
									   drop underneath and stay flush with the
									   bar's right edge. */
									flexWrap: { xs: 'wrap', sm: 'nowrap' },
									rowGap: 1,
									justifyContent: 'space-between',
									alignItems: 'center',
									gap: 1.5
								}}
							>
								{plannedStart ? (
									<Box
										component="label"
										sx={{
											display: 'flex',
											alignItems: 'center',
											minWidth: 0,
											gap: 1,
											cursor: 'pointer'
										}}
									>
										<Switch
											checked={motionOff}
											onChange={(next) =>
												setMotionOff(next)
											}
											aria-label={tr(
												'motionOff',
												'Animation abschalten'
											)}
										/>
										{/* The label is what gives when a translation
								    is longer than the German one — the button
								    beside it must never be pushed past the
								    edge the bar's buttons stop at. On a phone the
								    row wraps instead of dropping this sentence —
								    a naked switch says nothing (Frank drew the
								    row with its label, 2026-09-05). */}
										<Typography
											sx={{
												fontSize: 13,
												minWidth: 0,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
												color: registrationMd3.onSurfaceVariant
											}}
										>
											{tr(
												'motionOff',
												'Animation abschalten'
											)}
										</Typography>
									</Box>
								) : (
									<span />
								)}
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1,
										minWidth: 0,
										/* On the wrapped phone line the pair
										   takes the whole width, so its outer
										   edges sit on the bar's edges again. */
										width: { xs: '100%', sm: 'auto' },
										justifyContent: {
											xs: 'space-between',
											sm: 'flex-end'
										}
									}}
								>
									<Button
										variant="outlined"
										size="small"
										startIcon={<CalendarMonthRoundedIcon />}
										sx={moreButtonSx}
										onClick={() => setBookingOpen(true)}
										data-testid="group-entry-book"
									>
										{t(
											'booking.appointment.open',
											'Termin buchen'
										)}
									</Button>
									<Button
										variant="outlined"
										size="small"
										endIcon={<ArrowForwardRoundedIcon />}
										sx={moreButtonSx}
										onClick={() => setMoreOpen(true)}
										data-testid="group-entry-more"
									>
										{tr('more', 'Mehr erfahren')}
									</Button>
								</Box>
							</Box>
						</>
					)}
					{/* Desktop: calendar beside a visible but shut "Beitreten".
					    On a phone two buttons is one too many for the bar, so
					    there the calendar has it alone and "Beitreten" moves in
					    once the group is open. */}
					<RegistrationFooter
						secondary={narrow ? undefined : calendarAction}
						primary={
							narrow
								? active || !calendarAction
									? joinAction
									: calendarAction
								: joinAction
						}
					/>
					{plannedStart && (
						<GroupChatCalendarPopover
							id={menuId}
							anchorEl={calendarAnchor}
							onClose={() => setCalendarAnchor(null)}
							start={plannedStart}
							durationMinutes={durationMinutes}
							eventId={eventId}
						/>
					)}
				</Box>
			</StageLayout>
		</Box>
	);
};

/**
 * The horizontal inset of `RegistrationFooter`. The column repeats it so the
 * switch row above the bar starts where "Beitreten" starts and "Mehr erfahren"
 * ends where it ends — the row has to read as part of the bar, not as a line
 * that happened to stop somewhere else.
 */
const barInsetSx = { px: { xs: 2, sm: 3, lg: 4 } } as const;

/**
 * "Mehr erfahren" is the quiet way into the greeting and the rules, so it is
 * the small control in this row, not a second primary (Frank, 2026-09-07: "das
 * Mehr erfahren ist viel zu groß"). The theme's outlined button pads itself to
 * 50 px; this is 32. The invisible `::after` gives a finger the 44 px the eye
 * does not need, and stays inside the row's own 44 px so it never covers a
 * clock card above it.
 */
const moreButtonSx = {
	'whiteSpace': 'nowrap',
	'position': 'relative',
	'flexShrink': 0,
	'minHeight': 32,
	'py': 0,
	'px': 1.25,
	'fontSize': 13,
	'lineHeight': '18px',
	'& .MuiButton-endIcon': { ml: 0.5 },
	'& .MuiButton-startIcon': { mr: 0.5 },
	'& .MuiButton-endIcon > *, & .MuiButton-startIcon > *': { fontSize: 16 },
	'&::after': {
		content: '""',
		position: 'absolute',
		left: 0,
		right: 0,
		top: '50%',
		height: 44,
		transform: 'translateY(-50%)'
	}
} as const;

/**
 * How tall the clock may be: the window minus every band the screen puts above
 * and below it. The component only knows its own width; the screen knows this.
 *
 * The bottom of the sum is `bar + 12`, which is exactly what the column's
 * bottom padding reserves — whatever the stage prints under the column (its
 * legal links from 900 px up) is inside that padding already and cancels out,
 * so it does not appear here.
 *
 * Measured on the two stories, 2026-09-07:
 *
 * | band                    | phone | ≥ 1200 |
 * | ----------------------- | ----- | ------ |
 * | above the column        | 66    | 96     |
 * | column padding-top      | 8     | 8      |
 * | topic + agency (+ gap)  | 36+6  | —      |
 * | headline + subline      | 108   | 78     |
 * | headline → clock        | 8     | 8      |
 * | clock → switch row      | 8     | 8      |
 * | switch row              | 44    | 44     |
 * | bar + its 12 px of air  | 93    | 108    |
 * | **reserved**            | 377   | 350    |
 *
 * The headline band is the German measurement plus a line's worth of slack:
 * seven languages share this sentence and a subline that wraps must cost air,
 * never a scrollbar. Whatever is left over is split above and below the clock
 * by the centring column, so over-reserving reads as breathing room.
 *
 * 1200 is the stage split (topic and agency move into the header row), 900 is
 * where the stage prints its legal links, 520 is where the bar grows from 81
 * to 96 px — the three places the bands actually change.
 *
 * Exported as a plain function so the numbers above can be asserted without a
 * browser; the hook is only the window listener around it.
 */
export const entryRoomClockHeight = (width: number, height: number) => {
	const split = width >= 1200;
	const above = split ? 96 : 66 + 36 + 6;
	const headline = split ? 78 : 108;
	const bar = (width >= 520 ? 96 : 81) + 12;
	const reserved = above + 8 + headline + 8 + 8 + 44 + bar;
	return Math.max(160, height - reserved);
};

const useClockHeight = () => {
	const measure = () =>
		entryRoomClockHeight(window.innerWidth, window.innerHeight);
	const [height, setHeight] = useState(measure);
	useEffect(() => {
		const onResize = () => setHeight(measure());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	return height;
};
