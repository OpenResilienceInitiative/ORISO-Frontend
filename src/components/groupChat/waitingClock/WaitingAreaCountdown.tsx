import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { translateWithFallback } from '../../../utils/translationFallback';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { ClockDigits, ClockDigitsPop } from './ClockDigits';
import './waitingAreaCountdown.styles';

/** ORISO design palette for the waiting box, resolved through the M3 tokens. */
const RED = 'var(--m3-primary-container, #cc1e1c)';
const DARK = 'var(--m3-secondary, #374151)';
const MUTED = 'var(--m3-on-surface-variant, #444748)';
const INK = 'var(--m3-on-surface, #1a1c1e)';
const PINK = 'var(--m3-primary-fixed-dim, #ffb4aa)';

/** Discomfort grows one emoji per waiting minute (design: emojiStepSec 60). */
const OVERDUE_EMOJIS = ['😬', '😅', '🙄', '😳', '🫣', '😔', '😵‍💫', '🤯', '🫠'];
const EMOJI_STEP_SEC = 60;
const POP_INTERVAL_MS = 3000;
const CLOCK_SIZE = 30;

export interface WaitingAreaCountdownProps {
	/** When the group chat is scheduled to start. */
	plannedStart: Date;
	/** Personal greeting from the counsellor (behind the "days" number). */
	welcomeText?: string;
	/** Netiquette rules (behind the other numbers). */
	rules: string[];
	/** Force the calm, motion-free state (OS `prefers-reduced-motion` also applies). */
	reducedMotion?: boolean;
	/** Fixed "now" for tests/stories; defaults to a live 1s tick. */
	nowMs?: number;
	/** Add-to-calendar control rendered under the headline (future state only). */
	calendarSlot?: React.ReactNode;
}

interface Unit {
	key: string;
	label: string;
	value: number;
}

/**
 * The self-help group-chat waiting area (ORISO Design variant 4a/4b) — everything
 * inside the white box: headline, add-to-calendar, the "clock made of clocks"
 * whose number groups flip on click to reveal the counsellor's greeting (behind
 * the days) and the netiquette rules (behind hours/minutes/seconds), plus the
 * "switch off animation" toggle. Once the planned start has passed it counts up
 * (error tint, leading "+", smileys popping into single mini-clocks). Renders
 * into the real JoinGroupChatView; it does not draw the surrounding app shell.
 */
export const WaitingAreaCountdown = ({
	plannedStart,
	welcomeText,
	rules,
	reducedMotion = false,
	nowMs,
	calendarSlot
}: WaitingAreaCountdownProps) => {
	const { t: translate } = useTranslation();
	const tr = React.useCallback(
		(key: string, fallback: string, options?: Record<string, unknown>) =>
			translateWithFallback(
				translate,
				`groupChat.join.waitingArea.countdown.${key}`,
				fallback,
				options
			),
		[translate]
	);
	const prefersReducedMotion = usePrefersReducedMotion();
	const [tick, setTick] = React.useState(() => nowMs ?? Date.now());
	const [animOff, setAnimOff] = React.useState(false);
	const [flips, setFlips] = React.useState<Record<string, boolean>>({});
	const [backRule, setBackRule] = React.useState<Record<string, number>>({});
	const [hover, setHover] = React.useState<string | null>(null);
	const [pop, setPop] = React.useState<
		(ClockDigitsPop & { group: string }) | null
	>(null);

	React.useEffect(() => {
		if (nowMs !== undefined) {
			setTick(nowMs);
			return undefined;
		}
		const t = window.setInterval(() => setTick(Date.now()), 1000);
		return () => window.clearInterval(t);
	}, [nowMs]);

	const forcedMotionless = reducedMotion || prefersReducedMotion;
	const motionless = animOff || forcedMotionless;
	const remaining = (plannedStart.getTime() - tick) / 1000;
	const isOverdue = remaining <= 0;
	const rem = Math.max(0, remaining);
	const d = Math.floor(rem / 86400);
	const h = Math.floor(rem / 3600) % 24;
	const m = Math.floor(rem / 60) % 60;
	const s = Math.floor(rem) % 60;
	const elapsed = Math.max(0, -remaining);
	const oM = Math.floor(elapsed / 60) % 60;
	const oS = Math.floor(elapsed) % 60;
	const overdueEmoji =
		OVERDUE_EMOJIS[
			Math.min(
				OVERDUE_EMOJIS.length - 1,
				Math.floor(elapsed / EMOJI_STEP_SEC)
			)
		];

	// Overdue playfulness: every 3s one random mini-clock briefly becomes the
	// current discomfort smiley (3s visible, 3s off — mirrors the design).
	React.useEffect(() => {
		if (!isOverdue || motionless) {
			setPop(null);
			return undefined;
		}
		const t = window.setInterval(() => {
			setPop((current) =>
				current
					? null
					: {
							group: Math.random() < 0.5 ? 'om' : 'os',
							digit: Math.floor(Math.random() * 2),
							cell: Math.floor(Math.random() * 24),
							emoji: overdueEmoji
						}
			);
		}, POP_INTERVAL_MS);
		return () => window.clearInterval(t);
	}, [isOverdue, motionless, overdueEmoji]);

	const hasWelcome = !!welcomeText;
	const flippable = hasWelcome || rules.length > 0;

	const flip = (key: string, isRule: boolean) => {
		setFlips((prev) => {
			const open = !prev[key];
			if (open && isRule) {
				setBackRule((br) => ({
					...br,
					[key]: Math.floor(Math.random() * rules.length)
				}));
			}
			return { ...prev, [key]: open };
		});
	};

	const greetingLabel = tr('greetingLabel', 'Begrüßung deiner Beratung');
	const flipHint = tr('flipHint', 'klicken zum Umdrehen');

	const backCard = (key: string, isRule: boolean) => {
		const ruleIndex = backRule[key] ?? 0;
		const label = isRule
			? tr('netiquetteLabel', `Nettikette · Regel ${ruleIndex + 1}`, {
					no: ruleIndex + 1
				})
			: greetingLabel;
		const text = isRule ? (rules[ruleIndex] ?? '') : welcomeText;
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8,
					width: '100%',
					height: '100%',
					borderRadius: 16,
					background: DARK,
					boxSizing: 'border-box',
					padding: '0 20px',
					textAlign: 'center'
				}}
			>
				<div
					style={{
						fontSize: 9.5,
						fontWeight: 700,
						letterSpacing: '.13em',
						textTransform: 'uppercase',
						color: PINK
					}}
				>
					{label}
				</div>
				<div
					style={{
						fontSize: 14,
						fontWeight: 600,
						color: '#fff',
						lineHeight: 1.5
					}}
				>
					{text}
				</div>
			</div>
		);
	};

	const flipGroup = (
		unit: Unit,
		options: { rule?: boolean; tint?: boolean }
	) => {
		const isRule = options.rule ?? true;
		const flipped = !!flips[unit.key];
		const isHover = hover === unit.key;
		// Box must fit two clock-made-of-clocks digits (each 4×6 cells) plus label.
		const size = CLOCK_SIZE;
		const cellGap = Math.max(2, Math.round(size * 0.1));
		const digitW = size * 4 + cellGap * 3;
		const groupW = 2 * digitW + Math.round(size * 0.35);
		const groupH = size * 6 + cellGap * 5 + 36;
		const face = (
			visible: boolean,
			rot: number,
			content: React.ReactNode
		) => (
			<div
				// The hidden face is only a visual backface — keep it out of the
				// accessibility tree until the card is actually flipped.
				aria-hidden={!visible}
				style={{
					position: 'absolute',
					inset: 0,
					opacity: visible ? 1 : 0,
					transition: 'opacity 0s linear .3s',
					transform: `rotateY(${rot}deg)`,
					backfaceVisibility: 'hidden',
					WebkitBackfaceVisibility: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 8
				}}
			>
				{content}
			</div>
		);
		const front = (
			<>
				<ClockDigits
					value={unit.value}
					size={size}
					magnet
					tint={options.tint}
					pop={
						pop && pop.group === unit.key
							? {
									digit: pop.digit,
									cell: pop.cell,
									emoji: pop.emoji
								}
							: null
					}
				/>
				<div
					style={{
						fontSize: 10,
						fontWeight: 600,
						letterSpacing: '.16em',
						textTransform: 'uppercase',
						color: isHover ? RED : MUTED,
						transition: 'color .25s'
					}}
				>
					{unit.label}
				</div>
			</>
		);
		if (!flippable) {
			return (
				<div
					key={unit.key}
					style={{
						position: 'relative',
						width: groupW,
						height: groupH
					}}
				>
					{face(true, 0, front)}
				</div>
			);
		}
		return (
			<div
				key={unit.key}
				role="button"
				tabIndex={0}
				aria-label={tr(
					'flipAria',
					`${unit.label}: ${unit.value}. Umdrehen zum Lesen.`,
					{ label: unit.label, value: unit.value }
				)}
				aria-pressed={flipped}
				onClick={() => flip(unit.key, isRule)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						flip(unit.key, isRule);
					}
				}}
				onMouseEnter={() => setHover(unit.key)}
				onMouseLeave={() => setHover(null)}
				onFocus={() => setHover(unit.key)}
				onBlur={() => setHover(null)}
				style={{
					position: 'relative',
					width: groupW,
					height: groupH,
					perspective: 900,
					cursor: 'pointer',
					borderRadius: 16
				}}
			>
				<div
					aria-hidden="true"
					style={{
						position: 'absolute',
						top: -30,
						left: '50%',
						transform: `translateX(-50%) translateY(${isHover && !flipped ? 0 : 5}px)`,
						opacity: isHover && !flipped ? 1 : 0,
						transition: 'all .25s ease',
						background: DARK,
						color: '#fff',
						fontSize: 11,
						fontWeight: 600,
						padding: '5px 11px',
						borderRadius: 8,
						pointerEvents: 'none',
						whiteSpace: 'nowrap',
						zIndex: 3
					}}
				>
					{unit.label} · {flipHint}
				</div>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						transformStyle: 'preserve-3d',
						transition: 'transform .6s cubic-bezier(.4,0,.2,1)',
						transform: `rotateY(${flipped ? 180 : 0}deg)`
					}}
				>
					{face(!flipped, 0, front)}
					{face(flipped, 180, backCard(unit.key, isRule))}
				</div>
			</div>
		);
	};

	const toggleLabel = tr('toggleLabel', 'Animation abschalten');
	const toggle = (
		<label
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				fontSize: 12,
				color: MUTED,
				cursor: forcedMotionless ? 'default' : 'pointer',
				opacity: forcedMotionless ? 0.6 : 1
			}}
		>
			{toggleLabel}
			<button
				type="button"
				role="switch"
				aria-checked={motionless}
				aria-label={toggleLabel}
				disabled={forcedMotionless}
				onClick={() => setAnimOff((v) => !v)}
				style={{
					width: 46,
					height: 26,
					borderRadius: 13,
					border: motionless
						? `2px solid ${RED}`
						: '2px solid var(--m3-outline, #747878)',
					background: motionless
						? RED
						: 'var(--m3-surface-container-high, #eae7e8)',
					position: 'relative',
					cursor: forcedMotionless ? 'default' : 'pointer',
					padding: 0,
					transition: 'all .25s',
					flexShrink: 0
				}}
			>
				<span
					style={{
						position: 'absolute',
						top: motionless ? 1 : 3,
						left: motionless ? 21 : 3,
						width: motionless ? 20 : 16,
						height: motionless ? 20 : 16,
						borderRadius: '50%',
						background: motionless ? '#fff' : MUTED,
						transition: 'all .25s'
					}}
				/>
			</button>
		</label>
	);

	const eta =
		d > 0
			? d === 1
				? tr('etaDay', 'in einem Tag')
				: tr('etaDays', `in ${d} Tagen`, { count: d })
			: h > 0
				? h === 1
					? tr('etaHour', 'in einer Stunde')
					: tr('etaHours', `in ${h} Stunden`, { count: h })
				: m > 0
					? m === 1
						? tr('etaMinute', 'in einer Minute')
						: tr('etaMinutes', `in ${m} Minuten`, { count: m })
					: tr('etaSoon', 'gleich');
	const headline = isOverdue
		? tr('overdueHeadline', 'Wir sind gleich für dich da.')
		: tr('headline', `Dein Gruppen-Chat beginnt ${eta}.`, { eta });
	const subtitle = isOverdue
		? tr(
				'overdueSubtitle',
				'Deine Beratung öffnet den Raum gleich — bitte hab noch einen Moment Geduld.'
			)
		: tr(
				'subtitle',
				'Klick auf eine Zahl — dahinter warten Begrüßung und Nettikette.'
			);

	const units: Array<{ unit: Unit; rule: boolean; tint?: boolean }> =
		isOverdue
			? [
					{
						unit: {
							key: 'om',
							label: tr('unitMinutes', 'Minuten'),
							value: oM
						},
						rule: !hasWelcome,
						tint: true
					},
					{
						unit: {
							key: 'os',
							label: tr('unitSeconds', 'Sekunden'),
							value: oS
						},
						rule: true,
						tint: true
					}
				]
			: [
					{
						unit: {
							key: 'd',
							label: tr('unitDays', 'Tage'),
							value: d
						},
						rule: !hasWelcome
					},
					{
						unit: {
							key: 'h',
							label: tr('unitHours', 'Stunden'),
							value: h
						},
						rule: true
					},
					{
						unit: {
							key: 'm',
							label: tr('unitMinutes', 'Minuten'),
							value: m
						},
						rule: true
					},
					{
						unit: {
							key: 's',
							label: tr('unitSeconds', 'Sekunden'),
							value: s
						},
						rule: true
					}
				];

	const timerAria = isOverdue
		? tr(
				'timerAriaOverdue',
				`Seit dem geplanten Beginn: ${oM} Minuten und ${oS} Sekunden`,
				{ minutes: oM, seconds: oS }
			)
		: tr(
				'timerAriaFuture',
				`Noch ${d} Tage, ${h} Stunden, ${m} Minuten und ${s} Sekunden bis zum Beginn`,
				{ days: d, hours: h, minutes: m, seconds: s }
			);

	const plusSign = (
		<div
			aria-hidden="true"
			style={{
				alignSelf: 'center',
				fontSize: 64,
				fontWeight: 300,
				color: RED,
				lineHeight: 1,
				paddingBottom: 24
			}}
		>
			+
		</div>
	);

	const overdueCaption = isOverdue && (
		<div
			style={{
				alignSelf: 'center',
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				background: '#fdeded',
				borderRadius: 16,
				padding: '10px 18px',
				fontSize: 13,
				color: MUTED
			}}
		>
			<span aria-hidden="true" style={{ fontSize: 20 }}>
				{overdueEmoji}
			</span>
			{tr('overdueCaption', 'Das Warten wird langsam etwas unangenehm …')}
		</div>
	);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 26,
				fontFamily: 'inherit',
				color: INK
			}}
		>
			<div
				style={{
					textAlign: 'center',
					display: 'flex',
					flexDirection: 'column',
					gap: 6
				}}
			>
				<div
					style={{
						fontSize: 24,
						fontWeight: 700,
						letterSpacing: '-0.01em'
					}}
				>
					{headline}
				</div>
				<div style={{ fontSize: 13, color: MUTED }}>{subtitle}</div>
				{calendarSlot && !isOverdue && (
					<div style={{ alignSelf: 'center', marginTop: 10 }}>
						{calendarSlot}
					</div>
				)}
			</div>

			{motionless ? (
				<div
					role="timer"
					aria-label={timerAria}
					style={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: 24,
						justifyContent: 'center',
						alignItems: 'baseline',
						fontVariantNumeric: 'tabular-nums'
					}}
				>
					{isOverdue && (
						<div
							aria-hidden="true"
							style={{
								fontSize: 44,
								fontWeight: 300,
								color: RED,
								lineHeight: 1
							}}
						>
							+
						</div>
					)}
					{units.map(({ unit }) => (
						<div
							key={unit.key}
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 4
							}}
						>
							<div
								style={{
									fontSize: 54,
									fontWeight: 700,
									lineHeight: 1
								}}
							>
								{String(unit.value).padStart(2, '0')}
							</div>
							<div
								style={{
									fontSize: 10,
									fontWeight: 600,
									letterSpacing: '.16em',
									textTransform: 'uppercase',
									color: MUTED
								}}
							>
								{unit.label}
							</div>
						</div>
					))}
				</div>
			) : isOverdue ? (
				<div
					role="timer"
					aria-label={timerAria}
					style={{
						display: 'flex',
						gap: 28,
						justifyContent: 'center'
					}}
				>
					{plusSign}
					{units.map(({ unit, rule, tint }) =>
						flipGroup(unit, { rule, tint })
					)}
				</div>
			) : (
				<div
					role="timer"
					aria-label={timerAria}
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, auto)',
						gap: '30px 36px',
						justifyContent: 'center'
					}}
				>
					{units.map(({ unit, rule }) => flipGroup(unit, { rule }))}
				</div>
			)}

			{overdueCaption}

			{motionless && hasWelcome && (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 12,
						maxWidth: 560,
						alignSelf: 'center'
					}}
				>
					<div
						style={{
							background: isOverdue ? '#fdeded' : '#f9fafb',
							border: '1px solid var(--m3-outline-variant, #c4c7c8)',
							borderRadius: 16,
							padding: '16px 18px'
						}}
					>
						<div
							style={{
								fontSize: 9.5,
								fontWeight: 700,
								letterSpacing: '.14em',
								textTransform: 'uppercase',
								color: MUTED
							}}
						>
							{greetingLabel}
						</div>
						<div
							style={{
								fontWeight: 600,
								color: RED,
								lineHeight: 1.35,
								marginTop: 6
							}}
						>
							{welcomeText}
						</div>
					</div>
				</div>
			)}

			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				{toggle}
			</div>
		</div>
	);
};
