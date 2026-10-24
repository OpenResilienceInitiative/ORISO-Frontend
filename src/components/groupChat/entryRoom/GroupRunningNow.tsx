import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useTranslation } from 'react-i18next';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { WaitingAreaRules } from '../WaitingAreaRules';
import { translateWithFallback } from '../../../utils/translationFallback';

/**
 * Milliseconds since `since` — negative while it is still ahead — renewed
 * every second, or from the fixed `nowMs` of a story or test.
 */
export const useElapsed = (since: Date | null, nowMs?: number) => {
	const [now, setNow] = useState(() => nowMs ?? Date.now());
	const ticking = since !== null && nowMs === undefined;
	useEffect(() => {
		if (!ticking) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [ticking]);
	return since ? (nowMs ?? now) - since.getTime() : null;
};

export const splitElapsed = (ms: number) => {
	const total = Math.floor(ms / 1000);
	return {
		hours: Math.floor(total / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60
	};
};

const pad = (value: number) => String(value).padStart(2, '0');

/** "12:47", or "1:02:47" past the hour. */
export const formatElapsed = (ms: number) => {
	const { hours, minutes, seconds } = splitElapsed(ms);
	return hours
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
};

/* i18next tags like 'de@informal' are not BCP-47; `Intl` throws on them. */
export const useIntlLocale = () => {
	const { i18n } = useTranslation();
	return (i18n?.resolvedLanguage || i18n?.language || 'de').split('@')[0];
};

export interface GroupRunningNowProps {
	/** The planned start. Unset, or still ahead for a group opened early: no clock. */
	since: Date | null;
	nowMs?: number;
	rules: string[];
	motionOff: boolean;
	/** The counsellor who runs the group: she is the moderation. */
	moderator?: boolean;
}

/**
 * The waiting room once the group runs (Frank, 2026-10-19): no red overdue
 * clock, a calm one counting up how long the group has been on, so someone
 * who comes late sees they can still join. Grey, never the brand red — late
 * is allowed here.
 */
export const GroupRunningNow = ({
	since,
	nowMs,
	rules,
	motionOff,
	moderator = false
}: GroupRunningNowProps) => {
	const { t } = useTranslation();
	const locale = useIntlLocale();
	const elapsed = useElapsed(since, nowMs);
	// A group opened before its time gets the clock once that time comes.
	const begun = elapsed !== null && elapsed >= 0;
	const { hours, minutes, seconds } = splitElapsed(begun ? elapsed : 0);
	const relative = useMemo(
		() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
		[locale]
	);
	const ago =
		hours > 0
			? relative.format(-hours, 'hour')
			: relative.format(-minutes, 'minute');
	const unit = (key: keyof typeof UNIT) =>
		translateWithFallback(
			t,
			`groupChat.join.waitingArea.countdown.${key}`,
			UNIT[key]
		);
	const sinceLabel = t('groupChat.entry.running.since', 'Läuft seit');

	return (
		<Box
			data-cy="group-running"
			sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				textAlign: 'center',
				gap: { xs: 1.75, sm: 2.5 }
			}}
		>
			<Box
				sx={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 1,
					minHeight: 32,
					px: 1.75,
					borderRadius: '16px',
					bgcolor: RUNNING_TINT,
					color: RUNNING_INK,
					fontSize: 13,
					fontWeight: 600
				}}
			>
				<Box
					aria-hidden
					sx={{
						width: 8,
						height: 8,
						borderRadius: '50%',
						bgcolor: RUNNING_DOT
					}}
				/>
				{moderator
					? t('groupChat.entry.running.status', 'Läuft gerade')
					: t(
							'groupChat.entry.running.statusModerated',
							'Läuft gerade · Moderation ist da'
						)}
			</Box>
			<Box>
				<Typography
					component="h1"
					sx={{
						fontSize: { xs: 22, sm: 28 },
						lineHeight: 1.2,
						fontWeight: 700,
						color: registrationMd3.onSurface,
						textWrap: 'balance'
					}}
				>
					{begun
						? translateWithFallback(
								t,
								'groupChat.entry.running.headline',
								`Die Gruppe hat ${ago} begonnen.`,
								{ ago }
							)
						: t(
								'groupChat.entry.openHeadline',
								'Die Gruppe hat begonnen.'
							)}
				</Typography>
				<Typography
					sx={{
						mt: 1,
						fontSize: { xs: 15, sm: 16 },
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{t(
						'groupChat.entry.running.subline',
						'Sie können jederzeit dazukommen – niemand muss etwas sagen.'
					)}
				</Typography>
			</Box>
			{begun && (
				<Box
					role="timer"
					aria-label={`${sinceLabel}: ${hours} ${unit('unitHours')}, ${minutes} ${unit('unitMinutes')}`}
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: 1.25,
						width: '100%',
						maxWidth: 480
					}}
				>
					<Typography aria-hidden sx={captionSx}>
						{sinceLabel}
					</Typography>
					<Box
						aria-hidden
						sx={{
							display: 'grid',
							gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
							gap: { xs: 1, sm: 1.75 },
							width: '100%'
						}}
					>
						{(
							[
								[hours, 'unitHours'],
								[minutes, 'unitMinutes'],
								[seconds, 'unitSeconds']
							] as const
						).map(([value, key], index) => (
							<Box key={key} sx={tileSx}>
								<Box
									component="span"
									sx={{
										fontSize: { xs: 36, sm: 52 },
										lineHeight: 1,
										fontWeight: 700,
										fontVariantNumeric: 'tabular-nums',
										/* A zero hour stays quiet. */
										color:
											index === 0 && value === 0
												? registrationMd3.onSurfaceVariant
												: registrationMd3.onSurface
									}}
								>
									{pad(value)}
								</Box>
								<Box component="span" sx={captionSx}>
									{unit(key)}
								</Box>
							</Box>
						))}
					</Box>
				</Box>
			)}
			{rules.length > 0 && (
				<Box
					sx={{
						'display': 'flex',
						'alignItems': 'center',
						'gap': 1.25,
						'minHeight': 44,
						'maxWidth': '100%',
						'px': 2.5,
						'py': 1,
						'borderRadius': '22px',
						'bgcolor': registrationMd3.surfaceContainer,
						'color': registrationMd3.onSurface,
						'fontSize': 15,
						/* The rules' own spotlight, written here as well: the
						   stage room does not load the chat's stylesheet. One
						   rule at a time on one spot; with reduced motion all
						   of them, as lines. */
						'& .joinChat__rules': {
							listStyle: 'none',
							m: 0,
							p: 0,
							display: 'grid',
							minHeight: 0
						},
						'& .joinChat__rule': {
							gridArea: '1 / 1',
							opacity: 0,
							transition: 'opacity 0.4s ease'
						},
						'& .joinChat__rule--active': { opacity: 1 },
						'@media (prefers-reduced-motion: reduce)': {
							'& .joinChat__rules': { display: 'block' },
							'& .joinChat__rule': {
								opacity: 1,
								transition: 'none'
							}
						}
					}}
				>
					<ShieldOutlinedIcon
						aria-hidden
						sx={{
							fontSize: 18,
							color: registrationMd3.onSurfaceVariant
						}}
					/>
					<WaitingAreaRules
						rules={rules}
						animationOff={motionOff}
						ariaLabel={t(
							'groupChat.join.waitingArea.rulesLabel',
							'Chat rules'
						)}
					/>
				</Box>
			)}
		</Box>
	);
};

const UNIT = {
	unitHours: 'Stunden',
	unitMinutes: 'Minuten',
	unitSeconds: 'Sekunden'
} as const;

/* Status green, not a brand colour: a Träger's palette must not turn
   "läuft" red. */
const RUNNING_TINT = '#E3F1E6';
const RUNNING_INK = '#1F5130';
const RUNNING_DOT = '#2E7D4A';

const captionSx = {
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: '1.4px',
	textTransform: 'uppercase',
	color: registrationMd3.onSurfaceVariant
} as const;

const tileSx = {
	height: { xs: 104, sm: 148 },
	borderRadius: { xs: '18px', sm: '24px' },
	background: `linear-gradient(160deg, ${registrationMd3.surfaceContainerLowest}, ${registrationMd3.surfaceContainer})`,
	boxShadow: '0 4px 14px rgba(28, 27, 31, 0.08)',
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	gap: { xs: 0.5, sm: 1 }
} as const;
