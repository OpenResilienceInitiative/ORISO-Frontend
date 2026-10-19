import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { useTranslation } from 'react-i18next';
import { Switch } from '../../Switch';
import { WaitingRoomBar } from '../../waitingRoom/WaitingRoomBar';
import { WaitingAreaCountdown } from '../waitingClock/WaitingAreaCountdown';
import { WaitingAreaRules } from '../WaitingAreaRules';
import { GroupChatCalendarPopover } from '../GroupChatCalendarMenu';
import { GroupInfoGallery } from './GroupInfoGallery';
import { GroupUpcomingDates } from './GroupUpcomingDates';
import { GroupCalendarActions } from './GroupCalendarActions';
import { GroupHeading } from './GroupHeading';
import { GroupRunningNow, useIntlLocale } from './GroupRunningNow';
import { GroupRulesIntro } from './GroupRulesIntro';
import type { GroupChatRepeat } from '../groupChatCalendar';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { WaitingRoomFrame } from '../../waitingRoom/WaitingRoomFrame';
import { translateWithFallback } from '../../../utils/translationFallback';
import { GroupLegalMenu } from './GroupLegalMenu';
import { useGroupConsent } from '../consent/useGroupConsent';
import {
	useWaitingRoomConsent,
	WaitingRoomConsentPanel
} from '../../waitingRoom/WaitingRoomConsent';

export interface GroupWaitingRoomProps {
	/** The group's topic, shown small above the name. */
	topicName?: string;
	/** Who runs the group — the agency the chat is assigned to. */
	agencyName?: string;
	/**
	 * That agency's id. Its documents are what the legal links open —
	 * Datenschutz and Impressum of the Beratungsstelle that runs the group.
	 */
	agencyId?: number | null;
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
	/** The group's next dates, soonest first — shown behind "Alle Termine". */
	upcomingDates?: Date[];
	/** How the group repeats: the rhythm under the headline, the series export. */
	repeat?: GroupChatRepeat;
	/** A fixed "now" for stories and tests; the app leaves it unset. */
	nowMs?: number;
	/** Where "Einloggen" in the header goes. Off for someone already in. */
	showLoginLink?: boolean;
	/**
	 * The same room inside the app's chat card, under the chat's own header:
	 * no stage around it, the bar at the card's bottom edge (#1219).
	 */
	embedded?: boolean;
	/** "Beitreten" stays shut although the room is open (a banned member). */
	joinBlocked?: boolean;
	/**
	 * Who waits. `moderator` is the counsellor who opens the group: the clock
	 * speaks to her, and the bar is live before the group is open (#1689).
	 * Whether consent is asked is `askConsent`'s business.
	 */
	audience?: 'participant' | 'moderator';
	/** The bar's main label when it is not "Beitreten". */
	primaryLabel?: string;
	/**
	 * Ask the group's consent on "Beitreten". Off for staff: they agreed to
	 * the documents with their contract, not here.
	 */
	askConsent?: boolean;
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
	agencyId,
	plannedStart,
	durationMinutes = 60,
	eventId,
	welcomeText,
	rules,
	active,
	onJoin,
	joinBusy = false,
	upcomingDates,
	repeat,
	nowMs,
	showLoginLink = false,
	embedded = false,
	joinBlocked = false,
	audience = 'participant',
	primaryLabel,
	askConsent = true
}: GroupWaitingRoomProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.entry.${key}`, fallback),
		[t]
	);
	const [motionOff, setMotionOff] = useState(false);
	const [view, setView] = useState<'room' | 'more' | 'dates'>('room');
	const now = useNow(plannedStart, nowMs);
	const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(
		null
	);
	/* A date that has begun is not one to put in a calendar any more
	   (#1785); the dates after it still are. */
	const started =
		active || (plannedStart !== null && now >= plannedStart.getTime());
	// An opened group runs its planned date even before the clock says so.
	const runningMs = started ? plannedStart?.getTime() : undefined;
	const datesAhead = (
		upcomingDates ?? (plannedStart ? [plannedStart] : [])
	).filter((date) => date.getTime() > now && date.getTime() !== runningMs);
	const canAddThis = Boolean(plannedStart) && !started;
	const hasMoreDates = datesAhead.length > (canAddThis ? 1 : 0);
	/* The room's own width, not the window's: in the chat card a desktop
	   window can leave a 370 px column (#1499). */
	const [room, setRoom] = useState<HTMLElement | null>(null);
	const roomWidth = useWidth(room);
	const phone = useMediaQuery('(max-width:599px)');
	const inlineCalendar =
		roomWidth === null ? !phone : roomWidth >= INLINE_MIN_WIDTH;
	/* The dates view has its own buttons per date; the bar would repeat
	   them. */
	const calendarInBar = view !== 'dates' && (canAddThis || hasMoreDates);
	/* What the clock gives up: the rhythm line under the headline, and on
	   the stage the calendar row when it stands above "Beitreten" — the
	   bar is fixed, so its extra height is not the column's to see. */
	const showRhythm = Boolean(plannedStart) && !active;
	const rhythmReserve = showRhythm ? RHYTHM_HEIGHT : 0;
	const stageClockHeight = useClockHeight(
		rhythmReserve + (calendarInBar && !inlineCalendar ? STACKED_ROW : 0)
	);
	const [column, setColumn] = useState<HTMLElement | null>(null);
	const cardClockHeight = useCardClockHeight(
		embedded ? column : null,
		rhythmReserve
	);
	const clockHeight = embedded ? cardClockHeight : stageClockHeight;
	/* Gate 2 of ADR-022 is asked here, on "Beitreten", like the live chat
	   asks when the counsellor is there (Frank, 2026-10-16). */
	const groupConsent = useGroupConsent(agencyId);
	const legalDepartment = groupConsent.department;
	const consent = useWaitingRoomConsent({
		consentHtml: groupConsent.html,
		department: legalDepartment
	});
	const [asking, setAsking] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	// `saving` only disables the button after the next render; two quick
	// presses before it would record and join twice.
	const inFlight = useRef(false);
	const joinAfterConsent = () =>
		consent.guard(() => {
			if (!groupConsent.readable || inFlight.current) return;
			inFlight.current = true;
			setSaving(true);
			setSaveFailed(false);
			groupConsent
				.record()
				.then(() => onJoin())
				.catch(() => setSaveFailed(true))
				.finally(() => {
					inFlight.current = false;
					setSaving(false);
				});
		});
	const locale = useIntlLocale();
	const menuId = `${useId().replace(/:/g, '')}-entry-calendar`;

	// Same heading as the invitation's account step (#1689).
	const groupHeading = (
		<GroupHeading
			topicName={topicName}
			agencyName={agencyName}
			textAlign={embedded ? 'center' : { xs: 'center', lg: 'left' }}
		/>
	);

	const moderator = audience === 'moderator';
	/* The clock is for waiting. Once the group runs it would count up a
	   start that already happened, so the room says it has begun (#1787). */
	const showClock = Boolean(plannedStart) && !active;
	// The switch stops whatever moves: the clock, or the rules without it.
	const showMotionSwitch = showClock || rules.length > 0;
	const joinLabel = primaryLabel ?? tr('join', 'Beitreten');
	const backToRoom = useCallback(() => setView('room'), []);
	/* A shut "Beitreten" says when it opens (Frank, 2026-10-19). */
	const opensAtTime =
		plannedStart && !started && !moderator
			? new Intl.DateTimeFormat(locale, {
					weekday: 'short',
					hour: '2-digit',
					minute: '2-digit'
				}).format(plannedStart)
			: undefined;
	const opensAt =
		opensAtTime &&
		translateWithFallback(
			t,
			'groupChat.entry.joinFrom',
			`ab ${opensAtTime}`,
			{
				time: opensAtTime
			}
		);
	const joinAction = {
		label: joinLabel,
		onClick: askConsent ? () => setAsking(true) : onJoin,
		disabled: (!active && !moderator) || joinBusy || joinBlocked,
		status: opensAt,
		testId: 'group-entry-join'
	};
	const rhythm =
		showRhythm && plannedStart ? (
			<GroupRhythm
				start={plannedStart}
				durationMinutes={durationMinutes}
				repeat={repeat}
				locale={locale}
			/>
		) : undefined;
	/* On "Beitreten" in a running group the rules come up once, calm and
	   all at once, while the bar asks for consent. */
	const showRulesIntro = asking && active && askConsent && rules.length > 0;
	const calendarRow = calendarInBar ? (
		<GroupCalendarActions
			inline={inlineCalendar}
			onAddThis={
				canAddThis
					? (event) => setCalendarAnchor(event.currentTarget)
					: undefined
			}
			onMoreDates={hasMoreDates ? () => setView('dates') : undefined}
		/>
	) : null;

	const middle =
		view === 'more' ? (
			<GroupInfoGallery onBack={backToRoom} />
		) : view === 'dates' ? (
			<GroupUpcomingDates
				onBack={backToRoom}
				dates={datesAhead}
				durationMinutes={durationMinutes}
				eventId={eventId}
				repeat={repeat}
			/>
		) : showRulesIntro ? (
			<Box
				sx={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center'
				}}
			>
				<GroupRulesIntro
					rules={rules}
					since={plannedStart}
					nowMs={nowMs}
				/>
			</Box>
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
							display: embedded
								? 'block'
								: { xs: 'block', lg: 'none' }
						}}
					>
						{groupHeading}
					</Box>
					{showClock ? (
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
								audience={audience}
								reducedMotion={motionOff}
								hideMotionToggle
								calendarSlot={rhythm}
								gap={8}
							/>
						</Box>
					) : active ? (
						<GroupRunningNow
							since={plannedStart}
							nowMs={nowMs}
							rules={rules}
							motionOff={motionOff}
							moderator={moderator}
						/>
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
								{moderator
									? t(
											'groupChat.join.waitingArea.countdown.moderatorSubtitle',
											'Sie können den Chat starten, sobald Sie bereit sind.'
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
									animationOff={motionOff}
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
					{showMotionSwitch ? (
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
								onChange={(next) => setMotionOff(next)}
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
								{tr('motionOff', 'Animation abschalten')}
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
							endIcon={<ArrowForwardRoundedIcon />}
							sx={moreButtonSx}
							onClick={() => setView('more')}
							data-testid="group-entry-more"
						>
							{tr('more', 'Mehr erfahren')}
						</Button>
					</Box>
				</Box>
			</>
		);

	/* Calendar above a visible but shut "Beitreten", at
	    every width: the waiting room says what happens next,
	    and hiding the way in said nothing (Frank's Figma of
	    4.9.: „Beitreten ist vor dem Termin sichtbar, aber
	    gesperrt"). */
	const bar =
		asking && active && askConsent ? (
			<WaitingRoomBar
				contained={embedded}
				consent={
					<WaitingRoomConsentPanel
						consent={consent}
						heading={t(
							'groupChat.consent.headline',
							'Bevor Sie schreiben'
						)}
						/* Says whom the person joins (Frank, 2026-10-17). */
						subtitle={
							agencyName
								? t('groupChat.consent.descriptionNamed', {
										agency: agencyName,
										defaultValue:
											'Diese Gruppe wird von {{agency}} geleitet. Bitte stimmen Sie der Datenschutzerklärung dieser Beratungsstelle zu, bevor Sie in der Gruppe schreiben.'
									})
								: t(
										'groupChat.consent.description',
										'Diese Gruppe wird von einer Beratungsstelle geleitet. Bitte stimmen Sie ihrer Datenschutzerklärung zu, bevor Sie in der Gruppe schreiben.'
									)
						}
						declineLabel={t('groupChat.consent.reject', 'Ablehnen')}
						onDecline={() => setAsking(false)}
						missingText={t(
							'groupChat.consent.rejected',
							'Ohne Ihre Zustimmung können Sie in dieser Gruppe nicht schreiben. Sie können jederzeit später zustimmen.'
						)}
						error={
							saveFailed
								? t(
										'groupChat.consent.saveFailed',
										'Ihre Zustimmung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
									)
								: undefined
						}
						errorId="groupWaitingConsentError"
						disabled={saving || joinBusy}
					/>
				}
				primary={{
					...joinAction,
					onClick: joinAfterConsent,
					disabled:
						joinBusy ||
						saving ||
						joinBlocked ||
						!groupConsent.readable
				}}
			/>
		) : (
			<WaitingRoomBar
				contained={embedded}
				stacked={Boolean(calendarRow) && !inlineCalendar}
				primary={joinAction}
			>
				{calendarRow}
			</WaitingRoomBar>
		);
	const popover = canAddThis && plannedStart && (
		<GroupChatCalendarPopover
			id={menuId}
			anchorEl={calendarAnchor}
			onClose={() => setCalendarAnchor(null)}
			start={plannedStart}
			durationMinutes={durationMinutes}
			eventId={eventId}
		/>
	);

	if (embedded) {
		return (
			<Box
				sx={{
					flex: 1,
					minHeight: 0,
					display: 'flex',
					flexDirection: 'column'
				}}
				ref={setRoom}
				data-cy="group-entry-room"
				data-embedded="true"
			>
				{/* Only the column scrolls; the bar stays the card's last
				    row. */}
				<Box
					ref={setColumn}
					sx={{
						...barInsetSx,
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'safe center',
						pt: 2,
						pb: 1.5
					}}
				>
					{middle}
				</Box>
				{bar}
				{popover}
			</Box>
		);
	}

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
			<WaitingRoomFrame
				legalDepartment={legalDepartment}
				showLoginLink={showLoginLink}
				headerStart={groupHeading}
				/* The desktop stage prints the legal links; the phone bar
				   gets them as a menu, like every chat room (#1499). */
				renderHeaderAction={(tone) =>
					tone === 'onPrimary' ? (
						<GroupLegalMenu department={legalDepartment} />
					) : null
				}
			>
				<Box
					ref={setRoom}
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
					{middle}
					{bar}
					{popover}
				</Box>
			</WaitingRoomFrame>
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
 * From this room width the calendar pill stands beside "Beitreten" in one
 * row: the split pill is ~330 px, "Beitreten" keeps ~200, plus the bar's
 * inset. Below it the pills get their own row above.
 */
const INLINE_MIN_WIDTH = 640;

const RHYTHM: Record<GroupChatRepeat, string> = {
	DAILY: 'jeden Tag',
	WEEKLY: 'jede Woche',
	MONTHLY: 'jeden Monat'
};

/** The calendar row above "Beitreten" on a phone: 44 px pills, 16 px gap. */
const STACKED_ROW = 60;

/** The rhythm line under the headline: 36 px chip plus 10 px of air. */
const RHYTHM_HEIGHT = 46;

/**
 * "Do., 10.09. · 18:00 – 19:30 · jede Woche" — when the group meets, in one
 * line under the headline, so the date is readable without the clock.
 */
const GroupRhythm = ({
	start,
	durationMinutes,
	repeat,
	locale
}: {
	start: Date;
	durationMinutes: number;
	repeat?: GroupChatRepeat;
	locale: string;
}) => {
	const { t } = useTranslation();
	const day = new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit'
	}).format(start);
	const time = new Intl.DateTimeFormat(locale, {
		hour: '2-digit',
		minute: '2-digit'
	});
	const end = new Date(start.getTime() + durationMinutes * 60e3);
	const parts = [
		day,
		`${time.format(start)} – ${time.format(end)}`,
		repeat
			? translateWithFallback(
					t,
					`groupChat.entry.rhythm.${repeat}`,
					RHYTHM[repeat]
				)
			: null
	].filter(Boolean);
	return (
		<Box
			data-cy="group-entry-rhythm"
			sx={{
				'display': 'inline-flex',
				'alignItems': 'center',
				'gap': 1,
				'minHeight': 36,
				'px': 1.75,
				'borderRadius': '18px',
				'bgcolor': registrationMd3.selectedLayer,
				'color': registrationMd3.primaryDark,
				'fontSize': 13,
				'fontWeight': 600,
				'& svg': { fontSize: 18 }
			}}
		>
			<CalendarMonthRoundedIcon aria-hidden />
			<span>{parts.join(' · ')}</span>
		</Box>
	);
};

/** An element's width, renewed when it changes; `null` before it is measured. */
const useWidth = (element: HTMLElement | null) => {
	const [width, setWidth] = useState<number | null>(null);
	React.useLayoutEffect(() => {
		if (!element) return;
		const measure = () =>
			setWidth(element.getBoundingClientRect().width || null);
		measure();
		const RO = globalThis.ResizeObserver;
		if (!RO) return;
		const observer = new RO(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);
	return width;
};

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
export const entryRoomClockHeight = (
	width: number,
	height: number,
	extra = 0
) => {
	const split = width >= 1200;
	const above = split ? 96 : 66 + 36 + 6;
	const headline = split ? 78 : 108;
	const bar = (width >= 520 ? 96 : 81) + 12;
	const reserved = above + 8 + headline + extra + 8 + 8 + 44 + bar;
	return Math.max(160, height - reserved);
};

/**
 * "Now" for deciding whether the date has begun: the fixed `nowMs` of a
 * story, or the real time, renewed once when the start passes so the room
 * drops "Diesen Termin" without a reload.
 */
const useNow = (plannedStart: Date | null, nowMs?: number) => {
	const [realNow, setRealNow] = useState(() => Date.now());
	const startMs = plannedStart?.getTime();
	useEffect(() => {
		if (nowMs !== undefined || startMs === undefined) return;
		const wait = startMs - Date.now();
		if (wait <= 0) return;
		// setTimeout overflows past ~24.8 days and would fire at once.
		const timer = setTimeout(
			() => setRealNow(Date.now()),
			Math.min(wait + 50, 2 ** 31 - 1)
		);
		return () => clearTimeout(timer);
	}, [nowMs, startMs, realNow]);
	return nowMs ?? realNow;
};

const useClockHeight = (extra: number) => {
	/* The visual viewport is the part the person can actually see: a mobile
	   URL bar sliding in or a keyboard opening shrinks it without a `window`
	   resize, and the clock would keep a size that pushes the switch row and
	   "Mehr erfahren" below the fold. */
	const measure = () =>
		entryRoomClockHeight(
			window.visualViewport?.width ?? window.innerWidth,
			window.visualViewport?.height ?? window.innerHeight,
			extra
		);
	const [height, setHeight] = useState(measure);
	useEffect(() => {
		const onResize = () => setHeight(measure());
		onResize();
		window.addEventListener('resize', onResize);
		window.visualViewport?.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			window.visualViewport?.removeEventListener('resize', onResize);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `measure` only closes over `extra`
	}, [extra]);
	return height;
};

/**
 * The clock in the chat card: the column's own height minus the rows around
 * the clock (topic and agency, headline, switch row and the column's padding),
 * the same bands `entryRoomClockHeight` subtracts from the window.
 */
export const cardClockHeight = (
	columnHeight: number,
	columnWidth: number,
	extra = 0
) =>
	Math.max(
		160,
		columnHeight -
			(16 +
				42 +
				(columnWidth >= 600 ? 78 : 108) +
				extra +
				8 +
				8 +
				44 +
				12)
	);

const useCardClockHeight = (column: HTMLElement | null, extra: number) => {
	const [height, setHeight] = useState(320);
	useEffect(() => {
		if (!column) return;
		const measure = () =>
			setHeight(
				cardClockHeight(column.clientHeight, column.clientWidth, extra)
			);
		measure();
		const RO = globalThis.ResizeObserver;
		if (!RO) return;
		const observer = new RO(measure);
		observer.observe(column);
		return () => observer.disconnect();
	}, [column, extra]);
	return height;
};
