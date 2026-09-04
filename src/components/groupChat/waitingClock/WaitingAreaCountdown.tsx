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

/** Small caps label on the still-view cards. */
const stillLabelStyle: React.CSSProperties = {
	fontSize: 9.5,
	fontWeight: 700,
	letterSpacing: '.14em',
	textTransform: 'uppercase',
	color: MUTED
};

/** Discomfort grows one emoji per waiting minute (design: emojiStepSec 60). */
const OVERDUE_EMOJIS = ['😬', '😅', '🙄', '😳', '🫣', '😔', '😵‍💫', '🤯', '🫠'];
const EMOJI_STEP_SEC = 60;
const POP_INTERVAL_MS = 3000;
const CLOCK_SIZE = 30;
const FIT_MIN_SIZE = 12;
const FIT_MAX_SIZE = 80;

/**
 * Everything that follows from one mini-clock diameter. Kept in one place so the
 * flip cards, the fit calculation and the grid all agree on the same numbers.
 *
 * `tight` is Frank's "alle ganz nah beieinander": every gap — between cells,
 * between the two digits, between the four groups — is the cell gap, so the
 * whole clock is one continuous lattice. Otherwise the digits and groups get a
 * little air (35 % / 55 % of a cell), which is the "ein ganz bisschen Spacing"
 * variant he also wanted to see.
 */
const clockGeometry = (size: number, tight: boolean) => {
	const cellGap = Math.max(2, Math.round(size * 0.1));
	const digitGap = tight ? cellGap : Math.round(size * 0.35);
	const groupGap = tight ? cellGap : Math.round(size * 0.55);
	// Labels grow with the clock, within reason: 10 px on a phone, 13 px on
	// a desktop-sized block.
	const labelFont = Math.max(10, Math.min(13, Math.round(size * 0.27)));
	const labelH = labelFont + 12;
	const digitW = size * 4 + cellGap * 3;
	const groupW = 2 * digitW + digitGap;
	const groupH = size * 6 + cellGap * 5 + labelH;
	return {
		cellGap,
		digitGap,
		groupGap,
		labelFont,
		labelH,
		digitW,
		groupW,
		groupH
	};
};

/**
 * The largest mini-clock that still lets the whole clock fit the given box.
 * Walks down from the maximum; the first size that fits wins. Width alone
 * decides when no height is given.
 */
const fitClockSize = (
	width: number,
	height: number | undefined,
	overdue: boolean,
	tight: boolean
) => {
	for (let size = FIT_MAX_SIZE; size >= FIT_MIN_SIZE; size--) {
		const g = clockGeometry(size, tight);
		// Overdue: "+", two groups, and the flex gaps around the sign.
		const w = overdue
			? 2 * g.groupW + 2 * 28 + 56
			: 2 * g.groupW + g.groupGap;
		const h = overdue ? g.groupH : 2 * g.groupH + g.groupGap;
		if (w <= width && (height === undefined || h <= height)) {
			return size;
		}
	}
	return FIT_MIN_SIZE;
};

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
	/**
	 * Put the headline under the clock instead of above it.
	 *
	 * Frank, 2026-09-04: with the four digit groups on top and the sentence
	 * below, the whole thing reads as one block rather than a caption with a
	 * picture under it. Layout only — the reading order in the DOM is unchanged,
	 * so screen readers still hear the headline first.
	 */
	headlineBelow?: boolean;
	/**
	 * Diameter of one mini-clock in px. The clock is built from these, so this
	 * scales the whole thing. Default 30.
	 *
	 * `'fit'` measures the component's own width and picks the largest
	 * diameter at which the whole clock still fits — see `fitHeight` for the
	 * other axis. Frank, 2026-09-04, looking at the 44 px block on a phone
	 * where it overflowed: "bei dir ist einfach alles überschnitten". A fixed
	 * number can only be right for one screen; the clock has to size itself.
	 */
	clockSize?: number | 'fit';
	/**
	 * With `clockSize="fit"`: the height in px the clock may take. Without it,
	 * only the width decides. The surrounding screen knows what else has to
	 * fit on the page; the component does not.
	 */
	fitHeight?: number;
	/**
	 * `tight`: every gap is the cell gap, the clock is one lattice.
	 * `airy` (default): digits and groups get a little air. Both are Frank's
	 * 2026-09-04 variants; he wanted to see them side by side.
	 */
	spacing?: 'tight' | 'airy';
	/**
	 * Put the labels of the top row above their digits and those of the bottom
	 * row below, so nothing sits between the two rows. Frank, 2026-09-04: "mach
	 * die Pfeile mit den Tagen nach oben, dass wir eben dieses Gefühl haben,
	 * dass es wirklich ein Block ist."
	 */
	labelsOutside?: boolean;
	/**
	 * Hide the built-in "Animation abschalten" switch.
	 *
	 * Frank, 2026-09-04: the control belongs in the footer with the other
	 * actions, not floating in the surface. Set this when the surrounding screen
	 * offers it — the component keeps the behaviour, it just stops drawing its
	 * own switch. Leaving both visible would be two controls for one setting.
	 */
	hideMotionToggle?: boolean;
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
	headlineBelow = false,
	clockSize = CLOCK_SIZE,
	fitHeight,
	spacing = 'airy',
	labelsOutside = false,
	hideMotionToggle = false,
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

	const rootRef = React.useRef<HTMLDivElement>(null);
	const [measuredWidth, setMeasuredWidth] = React.useState<number | null>(
		null
	);
	React.useEffect(() => {
		if (clockSize !== 'fit' || !rootRef.current) {
			return undefined;
		}
		const el = rootRef.current;
		setMeasuredWidth(el.clientWidth);
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setMeasuredWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [clockSize]);

	const forcedMotionless = reducedMotion || prefersReducedMotion;
	const motionless = animOff || forcedMotionless;
	const remaining = (plannedStart.getTime() - tick) / 1000;
	const isOverdue = remaining <= 0;
	const tight = spacing === 'tight';
	const size =
		clockSize === 'fit'
			? measuredWidth === null
				? CLOCK_SIZE
				: fitClockSize(measuredWidth, fitHeight, isOverdue, tight)
			: clockSize;
	const geo = clockGeometry(size, tight);
	const rem = Math.max(0, remaining);
	const d = Math.floor(rem / 86400);
	const h = Math.floor(rem / 3600) % 24;
	const m = Math.floor(rem / 60) % 60;
	const s = Math.floor(rem) % 60;
	const elapsed = Math.max(0, -remaining);
	// Total elapsed minutes — an hour-late chat must read 60+, never wrap to 0.
	const oM = Math.floor(elapsed / 60);
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

	const backCard = (key: string, isRule: boolean) => {
		const ruleIndex = backRule[key] ?? 0;
		const label = isRule
			? tr('netiquetteLabel', `Netiquette · Regel ${ruleIndex + 1}`, {
					no: ruleIndex + 1
				})
			: greetingLabel;
		const text = isRule ? (rules[ruleIndex] ?? '') : welcomeText;
		// The card is as big as the digits it replaces, so its type grows with
		// the clock: 14 px on a phone, up to 20 px on a desktop block.
		const textFont = Math.round(Math.min(20, Math.max(14, size * 0.42)));
		// Frank, 2026-09-04: the greeting "wirkt so gleich wie die
		// Netiquetten". Rules are the house speaking — dark, factual. The
		// greeting is a person speaking — it gets the brand red and a
		// larger, warmer line, so the two are never mistaken for each other.
		const isGreeting = !isRule;
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: Math.round(size * 0.25),
					width: '100%',
					height: '100%',
					borderRadius: 20,
					background: isGreeting ? RED : DARK,
					boxSizing: 'border-box',
					padding: `${Math.round(size * 0.5)}px ${Math.round(size * 0.6)}px`,
					textAlign: 'center'
				}}
			>
				<div
					style={{
						fontSize: geo.labelFont,
						fontWeight: 700,
						letterSpacing: '.14em',
						textTransform: 'uppercase',
						color: isGreeting ? 'rgba(255,255,255,.72)' : PINK
					}}
				>
					{label}
				</div>
				<div
					style={{
						fontSize: isGreeting ? textFont + 2 : textFont,
						fontWeight: isGreeting ? 600 : 500,
						color: '#fff',
						lineHeight: 1.45,
						maxWidth: '32ch',
						textWrap: 'pretty'
					}}
				>
					{text}
				</div>
			</div>
		);
	};

	const flipGroup = (
		unit: Unit,
		options: { rule?: boolean; tint?: boolean; labelAbove?: boolean }
	) => {
		const isRule = options.rule ?? true;
		// A card only flips when its own back has content — rule cards need
		// rules, the greeting card needs a welcome text.
		const canFlip = isRule ? rules.length > 0 : hasWelcome;
		const flipped = !!flips[unit.key];
		const isHover = hover === unit.key;
		// Box must fit two clock-made-of-clocks digits (each 4×6 cells) plus label.
		const { groupW, groupH } = geo;
		const labelAbove = !!options.labelAbove;
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
					gap: 2
				}}
			>
				{content}
			</div>
		);
		const label = (
			<div
				style={{
					fontSize: geo.labelFont,
					fontWeight: 600,
					letterSpacing: '.16em',
					textTransform: 'uppercase',
					color: isHover ? RED : MUTED,
					transition: 'color .25s',
					// Centred over its two digits, above and below alike —
					// Frank's Figma has TAGE centred too, and a left-aligned
					// top row against a centred bottom row read as two rules.
					alignSelf: 'center'
				}}
			>
				{unit.label}
			</div>
		);
		const front = (
			<>
				{labelAbove && label}
				<ClockDigits
					value={unit.value}
					size={size}
					digitGap={geo.digitGap}
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
				{!labelAbove && label}
			</>
		);
		if (!canFlip) {
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
				{/* No tooltip. It repeated the label that already stands under
				    the digits and it stayed up over the flipped card. The one
				    hint lives in the subtitle; the hover itself is the cue:
				    the card tilts a few degrees towards the reader, and the
				    label turns red. */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						transformStyle: 'preserve-3d',
						transition: 'transform .6s cubic-bezier(.4,0,.2,1)',
						transform: `rotateY(${flipped ? 180 : isHover ? -10 : 0}deg)`
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
		: motionless
			? tr(
					'subtitleStill',
					'Begrüßung und Netiquette stehen unter den Zahlen.'
				)
			: tr(
					'subtitle',
					'Klick auf eine Zahl — dahinter warten Begrüßung und Netiquette.'
				);
	// The still view keeps the clock's footprint, so the row under it and the
	// bar never move when someone flips the switch (Frank, 2026-09-04: "er
	// sollte auf jeden Fall nicht springen").
	const clockFootprint = isOverdue
		? geo.groupH
		: 2 * geo.groupH + geo.groupGap;

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

	// "unit: value" phrasing stays grammatical for every count in every locale
	// (no plural agreement needed).
	const timerAria = isOverdue
		? tr(
				'timerAriaOverdue',
				`Seit dem geplanten Beginn — Minuten: ${oM}, Sekunden: ${oS}`,
				{ minutes: oM, seconds: oS }
			)
		: tr(
				'timerAriaFuture',
				`Bis zum Beginn — Tage: ${d}, Stunden: ${h}, Minuten: ${m}, Sekunden: ${s}`,
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
			ref={rootRef}
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 26,
				width: '100%',
				minWidth: 0,
				fontFamily: 'inherit',
				color: INK
			}}
		>
			<div
				style={{
					textAlign: 'center',
					display: 'flex',
					flexDirection: 'column',
					gap: 6,
					/* Visual order only. The DOM order stays headline-first so
					   assistive technology reads the sentence before the
					   digits. */
					order: headlineBelow ? 2 : 0
				}}
			>
				<div
					style={{
						// Frank, 2026-09-04: "mit der Schriftgröße ein bisschen
						// arbeiten … beim Titel". Grows with the column, never
						// past 30 px, never below the old 24 on a phone.
						fontSize: 'clamp(24px, 2.4vw, 30px)',
						lineHeight: 1.2,
						fontWeight: 700,
						letterSpacing: '-0.01em',
						textWrap: 'balance'
					}}
				>
					{headline}
				</div>
				<div
					style={{
						fontSize: 'clamp(13px, 1.1vw, 15px)',
						color: MUTED
					}}
				>
					{subtitle}
				</div>
				{calendarSlot && !isOverdue && (
					<div style={{ alignSelf: 'center', marginTop: 10 }}>
						{calendarSlot}
					</div>
				)}
			</div>

			{motionless ? (
				<div
					style={{
						minHeight: clockFootprint,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'stretch',
						gap: 24
					}}
				>
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
					{/* Without the flip there is nothing behind the numbers, so
				    the greeting and the rules stand here in the open — the
				    still view must not lose what the moving one has. */}
					{(hasWelcome || rules.length > 0) && (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: 12,
								width: '100%',
								maxWidth: 560,
								alignSelf: 'center'
							}}
						>
							{hasWelcome && (
								<div
									style={{
										background: isOverdue
											? '#fdeded'
											: '#f9fafb',
										border: '1px solid var(--m3-outline-variant, #c4c7c8)',
										borderRadius: 16,
										padding: '16px 18px'
									}}
								>
									<div style={stillLabelStyle}>
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
							)}
							{rules.length > 0 && (
								<div
									style={{
										background: '#f9fafb',
										border: '1px solid var(--m3-outline-variant, #c4c7c8)',
										borderRadius: 16,
										padding: '16px 18px'
									}}
								>
									<div style={stillLabelStyle}>
										{tr('netiquetteTitle', 'Netiquette')}
									</div>
									<ol
										style={{
											margin: '6px 0 0',
											paddingLeft: 20,
											display: 'flex',
											flexDirection: 'column',
											gap: 4,
											fontSize: 14,
											lineHeight: 1.45
										}}
									>
										{rules.map((rule) => (
											<li key={rule}>{rule}</li>
										))}
									</ol>
								</div>
							)}
						</div>
					)}
				</div>
			) : isOverdue ? (
				<div
					role="timer"
					aria-label={timerAria}
					className="waitingClock__timerOverdue"
				>
					{plusSign}
					{units.map(({ unit, rule, tint }) =>
						flipGroup(unit, { rule, tint, labelAbove: false })
					)}
				</div>
			) : (
				<div
					role="timer"
					aria-label={timerAria}
					className="waitingClock__timer"
					// The stylesheet's gap is the default; the geometry decides
					// here so the four groups keep the same rhythm as the cells.
					style={{ gap: geo.groupGap }}
				>
					{units.map(({ unit, rule }, index) =>
						flipGroup(unit, {
							rule,
							labelAbove: labelsOutside && index < 2
						})
					)}
				</div>
			)}

			{overdueCaption}

			{/* Rendered only when it has content: an empty row still costs the
			    column gap (26 px measured), and every one of those pixels is
			    one the clock cannot have. */}
			{!hideMotionToggle && (
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					{toggle}
				</div>
			)}
		</div>
	);
};
