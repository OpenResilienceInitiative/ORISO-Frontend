import * as React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Typography,
	useMediaQuery
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from 'react-i18next';
import { Switch } from '../../Switch';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { WaitingAreaCountdown } from '../waitingClock/WaitingAreaCountdown';
import { WaitingAreaRules } from '../WaitingAreaRules';
import { GroupChatCalendarPopover } from '../GroupChatCalendarMenu';
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
	const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(
		null
	);
	const clockHeight = useClockHeight();
	const narrow = useMediaQuery('(max-width:1199px)');
	const menuId = `${useId().replace(/:/g, '')}-entry-calendar`;

	const groupHeading = (
		<Box sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
			{topicName && (
				<Typography
					sx={{
						fontSize: 11,
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

	return (
		<Box sx={{ minHeight: '100vh' }} data-cy="group-entry-room">
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
						width: '100%',
						minWidth: 0,
						maxWidth: '100%',
						minHeight: {
							xs: 'calc(100vh - 96px)',
							lg: 'calc(100vh - 128px)'
						},
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						px: 2,
						pt: 1,
						pb: '100px'
					}}
				>
					<Box
						sx={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							gap: 1
						}}
					>
						<Box sx={{ display: { xs: 'block', lg: 'none' } }}>
							{groupHeading}
						</Box>
						{plannedStart ? (
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
								gap={12}
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
					<Box
						sx={{
							mt: 'auto',
							pt: 1,
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: 2
						}}
					>
						{plannedStart ? (
							<Box
								component="label"
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
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
								<Typography
									sx={{
										fontSize: 13,
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
						<Button
							variant="outlined"
							size="small"
							endIcon={<ArrowForwardRoundedIcon />}
							sx={{ whiteSpace: 'nowrap' }}
							onClick={() => setMoreOpen(true)}
							data-testid="group-entry-more"
						>
							{tr('more', 'Mehr erfahren')}
						</Button>
					</Box>
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
			<Dialog
				open={moreOpen}
				onClose={() => setMoreOpen(false)}
				fullWidth
				maxWidth="sm"
			>
				<DialogTitle>
					{tr('moreTitle', 'So läuft die Gruppe')}
				</DialogTitle>
				<DialogContent>
					{welcomeText && (
						<Typography sx={{ mb: 2 }}>{welcomeText}</Typography>
					)}
					{rules.length > 0 && (
						<Box component="ol" sx={{ pl: 3, m: 0 }}>
							{rules.map((rule) => (
								<Typography
									component="li"
									key={rule}
									sx={{ mb: 1 }}
								>
									{rule}
								</Typography>
							))}
						</Box>
					)}
					<Typography
						sx={{ mt: 2, color: registrationMd3.onSurfaceVariant }}
					>
						{active
							? tr(
									'moreOpen',
									'Die Moderation hat die Gruppe geöffnet. Mit „Beitreten" sind Sie im Gespräch.'
								)
							: tr(
									'moreWaiting',
									'Sobald die Moderation die Gruppe öffnet, wird „Beitreten" hier frei. Sie müssen nichts tun.'
								)}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setMoreOpen(false)}>
						{t('groupChat.join.button.label.close', 'Schließen')}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

/**
 * How tall the clock may be: the window minus what the screen puts around
 * it. The component only knows its width; the screen knows this.
 * Measured on the 1440 × 950 story: stage header 96 (64 + 42 on a phone,
 * where the group block stands in the column) and 32 under the column, bar
 * 96 + 4, column 8 above, headline block 60 + 12, switch row 8 + 40, and 28
 * so a rounding error never shows as a scrollbar.
 */
const useClockHeight = () => {
	const measure = () => {
		const mobile = window.innerWidth < 1200;
		const reserved =
			(mobile ? 64 + 42 : 96) + 32 + 8 + 100 + 60 + 12 + 8 + 40 + 28;
		return Math.max(160, window.innerHeight - reserved);
	};
	const [height, setHeight] = useState(measure);
	useEffect(() => {
		const onResize = () => setHeight(measure());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	return height;
};
