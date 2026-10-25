import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Box, ButtonBase, Typography, useMediaQuery } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { translateWithFallback } from '../../../utils/translationFallback';
import { GroupChatCalendarPopover } from '../GroupChatCalendarMenu';
import type { GroupChatRepeat, GroupChatSeries } from '../groupChatSeries';
import { EntryRoomPanel } from './EntryRoomPanel';
import { useIntlLocale } from './GroupRunningNow';

export interface GroupUpcomingDatesProps {
	/** Back to the waiting room. Called once the slide-back has played. */
	onBack: () => void;
	/** The dates still ahead, soonest first. */
	dates: Date[];
	durationMinutes: number;
	/** The chat id; the calendar event's UID adds the date to it. */
	eventId: string | number;
	/**
	 * How the group repeats and how many dates are left from `dates[0]` on;
	 * those can go in all at once.
	 */
	series?: GroupChatSeries;
}

type Open = { anchor: HTMLElement; date: Date; series: boolean };

/**
 * "Die nächsten Treffen" — the group's dates still ahead, each one for the
 * calendar on its own, or all at once as a series (Frank, 2026-10-19). Day
 * tiles like the live chat's opening hours on a wide column, rows with a
 * date badge on a phone. It takes the waiting room's middle like "Mehr
 * erfahren" does, and "Beitreten" stays in the bar below it.
 */
export const GroupUpcomingDates = ({
	onBack,
	dates,
	durationMinutes,
	eventId,
	series
}: GroupUpcomingDatesProps) => {
	const { t } = useTranslation();
	const tr = useCallback(
		(key: string, fallback: string) =>
			translateWithFallback(t, `groupChat.entry.dates.${key}`, fallback),
		[t]
	);
	const phone = useMediaQuery('(max-width:599px)');
	// The dates follow the language the person reads, not the browser's.
	const locale = useIntlLocale();
	const formats = useMemo(
		() => ({
			weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
			day: new Intl.DateTimeFormat(locale, {
				day: '2-digit',
				month: '2-digit'
			}),
			dayNumber: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
			month: new Intl.DateTimeFormat(locale, { month: 'long' }),
			time: new Intl.DateTimeFormat(locale, {
				hour: '2-digit',
				minute: '2-digit'
			})
		}),
		[locale]
	);
	const [open, setOpen] = useState<Open | null>(null);
	const repeat = series?.repeat;
	const canExportSeries = Boolean(series && series.count > 1 && dates.length);

	const describe = (date: Date) => {
		const end = new Date(date.getTime() + durationMinutes * 60e3);
		const time = `${formats.time.format(date)} – ${formats.time.format(end)}`;
		return {
			weekday: formats.weekday.format(date),
			day: formats.day.format(date),
			dayNumber: formats.dayNumber.format(date),
			month: formats.month.format(date),
			time
		};
	};

	return (
		<EntryRoomPanel
			onBack={onBack}
			backLabel={t('groupChat.info.gallery.back', 'Zurück zum Countdown')}
			backTestId="group-dates-back"
			dataCy="group-upcoming-dates"
		>
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: { xs: 'flex-start', sm: 'center' },
					textAlign: { xs: 'left', sm: 'center' },
					gap: { xs: 0.75, sm: 1.5 },
					mb: { xs: 2, sm: 3 }
				}}
			>
				<Box
					aria-hidden
					sx={{
						'display': { xs: 'none', sm: 'flex' },
						'width': 64,
						'height': 64,
						'borderRadius': '50%',
						'bgcolor': registrationMd3.surfaceContainer,
						'color': registrationMd3.primary,
						'alignItems': 'center',
						'justifyContent': 'center',
						'& svg': { fontSize: 30 }
					}}
				>
					<CalendarMonthRoundedIcon />
				</Box>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 26, sm: 32 },
						lineHeight: { xs: '32px', sm: '38px' },
						fontWeight: 700,
						color: registrationMd3.onSurface
					}}
				>
					{tr('headline', 'Die nächsten Treffen')}
				</Typography>
				<Typography
					sx={{
						fontSize: 16,
						color: registrationMd3.onSurfaceVariant,
						maxWidth: 560
					}}
				>
					{dates.length
						? [
								repeat &&
									tr(
										`repeat.${repeat}`,
										REPEAT_SENTENCE[repeat]
									),
								tr(
									'subline',
									'Tippen Sie auf einen Termin, um ihn einzutragen.'
								)
							]
								.filter(Boolean)
								.join(' ')
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
					width: '100%',
					...(phone
						? {
								display: 'flex',
								flexDirection: 'column',
								gap: 1.25
							}
						: {
								display: 'grid',
								gridTemplateColumns:
									'repeat(auto-fill, minmax(140px, 1fr))',
								gap: 1.5,
								maxWidth: 680,
								alignSelf: 'center',
								mx: 'auto'
							})
				}}
			>
				{dates.map((date, index) => {
					const when = describe(date);
					const next = index === 0;
					const label = t('groupChat.entry.dates.addLabel', {
						date: `${when.weekday} ${when.day}, ${when.time}`,
						defaultValue: '{{date}} zum Kalender hinzufügen'
					});
					const onClick = (event: React.MouseEvent<HTMLElement>) =>
						setOpen({
							anchor: event.currentTarget,
							date,
							series: false
						});
					return (
						<Box
							component="li"
							key={date.toISOString()}
							data-cy="group-upcoming-date"
							data-next={next || undefined}
						>
							<ButtonBase
								aria-label={label}
								onClick={onClick}
								data-testid="group-upcoming-date-add"
								sx={{
									...tileBaseSx,
									...(phone ? rowSx : tileSx),
									...(next ? nextSx : {})
								}}
							>
								{phone ? (
									<>
										<Box sx={badgeSx} aria-hidden>
											<Box
												component="span"
												sx={{
													fontSize: 12,
													fontWeight: 700,
													color: registrationMd3.primary,
													textTransform: 'uppercase'
												}}
											>
												{when.weekday.replace('.', '')}
											</Box>
											<Box
												component="span"
												sx={{
													fontSize: 20,
													fontWeight: 700
												}}
											>
												{when.dayNumber}
											</Box>
										</Box>
										<Box
											aria-hidden
											sx={{
												flex: 1,
												minWidth: 0,
												display: 'flex',
												flexDirection: 'column',
												gap: 0.25
											}}
										>
											{next && <NextMark />}
											<Box
												component="span"
												sx={{
													fontSize: 15,
													fontWeight: 600
												}}
											>
												{when.month} ·{' '}
												<Box
													component="span"
													sx={{
														whiteSpace: 'nowrap'
													}}
												>
													{when.time}
												</Box>
											</Box>
										</Box>
										<Box sx={plusSx} aria-hidden>
											<AddRoundedIcon />
										</Box>
									</>
								) : (
									<>
										{next ? (
											<NextMark />
										) : (
											<Box sx={{ height: 16 }} />
										)}
										<Box
											component="span"
											aria-hidden
											sx={{
												fontSize: 20,
												fontWeight: 700
											}}
										>
											{when.weekday}
										</Box>
										<Box
											component="span"
											aria-hidden
											sx={{
												fontSize: 15,
												fontWeight: 600
											}}
										>
											{when.day}
										</Box>
										<Box
											component="span"
											aria-hidden
											sx={{
												fontSize: 13,
												color: registrationMd3.onSurfaceVariant,
												whiteSpace: 'nowrap'
											}}
										>
											{when.time}
										</Box>
										<Box
											component="span"
											aria-hidden
											sx={addChipSx}
										>
											<AddRoundedIcon />
											{tr('add', 'Eintragen')}
										</Box>
									</>
								)}
							</ButtonBase>
						</Box>
					);
				})}
				{canExportSeries && (
					<Box component="li">
						<ButtonBase
							onClick={(event) =>
								setOpen({
									anchor: event.currentTarget,
									date: dates[0],
									series: true
								})
							}
							data-testid="group-upcoming-series"
							sx={{
								...tileBaseSx,
								...(phone ? seriesRowSx : tileSx),
								border: `1px dashed ${registrationMd3.outline}`,
								bgcolor: 'transparent',
								color: registrationMd3.onSurfaceVariant
							}}
						>
							<RepeatRoundedIcon
								aria-hidden
								sx={{ fontSize: phone ? 20 : 26 }}
							/>
							{phone ? (
								<Box
									component="span"
									sx={{
										fontSize: 14,
										fontWeight: 600,
										color: registrationMd3.onSurface
									}}
								>
									{tr(
										'seriesLong',
										'Alle als Serie eintragen'
									)}
								</Box>
							) : (
								<>
									<Box
										component="span"
										sx={{
											fontSize: 14,
											fontWeight: 600,
											color: registrationMd3.onSurface
										}}
									>
										{tr('seriesTitle', 'Alle auf einmal')}
									</Box>
									<Box component="span" sx={{ fontSize: 12 }}>
										{tr('seriesSub', 'als Serie eintragen')}
									</Box>
								</>
							)}
						</ButtonBase>
					</Box>
				)}
			</Box>
			{open && (
				<GroupChatCalendarPopover
					anchorEl={open.anchor}
					onClose={() => setOpen(null)}
					start={open.date}
					durationMinutes={durationMinutes}
					eventId={eventId}
					series={open.series ? series : undefined}
				/>
			)}
		</EntryRoomPanel>
	);
};

const REPEAT_SENTENCE: Record<GroupChatRepeat, string> = {
	DAILY: 'Die Gruppe trifft sich jeden Tag zur selben Zeit.',
	WEEKLY: 'Die Gruppe trifft sich jede Woche zur selben Zeit.',
	BIWEEKLY: 'Die Gruppe trifft sich alle zwei Wochen zur selben Zeit.',
	MONTHLY: 'Die Gruppe trifft sich jeden Monat zur selben Zeit.',
	QUARTERLY: 'Die Gruppe trifft sich jedes Quartal zur selben Zeit.',
	YEARLY: 'Die Gruppe trifft sich jedes Jahr zur selben Zeit.'
};

const NextMark = () => {
	const { t } = useTranslation();
	return (
		<Box
			component="span"
			sx={{
				fontSize: 11,
				lineHeight: '16px',
				fontWeight: 700,
				letterSpacing: '1px',
				textTransform: 'uppercase',
				color: registrationMd3.primaryDark
			}}
		>
			{t('groupChat.entry.dates.next', 'Nächster')}
		</Box>
	);
};

const tileBaseSx = {
	'width': '100%',
	'height': '100%',
	'borderRadius': '16px',
	'fontFamily': 'inherit',
	'color': registrationMd3.onSurface,
	'bgcolor': registrationMd3.selectedLayer,
	'transition': 'background-color 120ms, box-shadow 120ms',
	'&:hover': { boxShadow: '0 2px 8px rgba(28, 27, 31, 0.12)' },
	'&:focus-visible': {
		outline: `3px solid ${registrationMd3.focusLayer}`,
		outlineOffset: 2
	}
} as const;

/* The live chat's day tile, one size up: it carries a date and a button. */
const tileSx = {
	flexDirection: 'column',
	gap: 0.75,
	pt: 2,
	pb: 1.75,
	px: 1.25,
	minHeight: 172
} as const;

const rowSx = {
	justifyContent: 'flex-start',
	textAlign: 'left',
	gap: 1.75,
	p: 1.5
} as const;

const seriesRowSx = {
	minHeight: 48,
	gap: 1
} as const;

/* The next meeting stands out by an edge, not by another colour. */
const nextSx = {
	'boxShadow': `inset 0 0 0 1.5px ${registrationMd3.primary}`,
	'&:hover': {
		boxShadow: `inset 0 0 0 1.5px ${registrationMd3.primary}, 0 2px 8px rgba(28, 27, 31, 0.12)`
	}
} as const;

const badgeSx = {
	width: 52,
	height: 56,
	flexShrink: 0,
	borderRadius: '12px',
	bgcolor: registrationMd3.surfaceContainerLowest,
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	lineHeight: 1.15
} as const;

const plusSx = {
	'width': 40,
	'height': 40,
	'flexShrink': 0,
	'borderRadius': '50%',
	'bgcolor': registrationMd3.surfaceContainerLowest,
	'color': registrationMd3.primary,
	'display': 'flex',
	'alignItems': 'center',
	'justifyContent': 'center',
	'& svg': { fontSize: 20 }
} as const;

const addChipSx = {
	'mt': 1,
	'display': 'inline-flex',
	'alignItems': 'center',
	'gap': 0.5,
	'height': 32,
	'px': 1.5,
	'borderRadius': '16px',
	'bgcolor': registrationMd3.surfaceContainerLowest,
	'color': registrationMd3.primary,
	'fontSize': 13,
	'fontWeight': 600,
	'& svg': { fontSize: 16 }
} as const;
