import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { translateWithFallback } from '../../../utils/translationFallback';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { ClockDigits, ClockDigitsPop } from './ClockDigits';
import { faceDigitCount, faceDigits } from './waitingClockDigits';
import './waitingAreaCountdown.styles';

/** ORISO design palette for the waiting box, resolved through the M3 tokens. */
const RED = 'var(--m3-primary-container, #cc1e1c)';
const DARK = 'var(--m3-secondary, #374151)';
const MUTED = 'var(--m3-on-surface-variant, #444748)';
const INK = 'var(--m3-on-surface, #1a1c1e)';
/**
 * The pale brand tint the overdue clock faces carry — kept in step with
 * `$clock-face-tint-top` in waitingAreaCountdown.styles.scss (#1499).
 */
const TINT = 'var(--m3-primary-fixed, #ffdad5)';
const PINK = 'var(--m3-primary-fixed-dim, #ffb4aa)';

/** Discomfort grows one emoji per waiting minute (design: emojiStepSec 60). */
const OVERDUE_EMOJIS = ['😬', '😅', '🙄', '😳', '🫣', '😔', '😵‍💫', '🤯', '🫠'];
const EMOJI_STEP_SEC = 60;
const POP_INTERVAL_MS = 3000;
const CLOCK_SIZE = 30;
const FIT_MIN_SIZE = 12;
const FIT_MAX_SIZE = 80;

/**
 * Below this width the clock is drawn in its compact form. Mirrors `$fromMedium`
 * (600px) from settings.scss, so the SCSS breakpoints and the geometry below
 * always flip at the same width.
 */
const COMPACT_QUERY = '(max-width: 599.98px)';

/**
 * True on a phone-sized viewport. Frank, 2026-09-07: "Insgesamt sehe ich bei der
 * mobilen Version aber auch echt Platz, dass die Uhr insgesamt größer wird."
 * The component has to know the viewport, not only its own width, because the
 * things it drops on a phone (the gravity/magnet effect, most of the air) are
 * about the device, not about the column it happens to sit in.
 */
const useCompactViewport = (): boolean => {
	const [compact, setCompact] = React.useState(false);
	React.useEffect(() => {
		if (
			typeof window === 'undefined' ||
			typeof window.matchMedia !== 'function'
		) {
			return undefined;
		}
		const mql = window.matchMedia(COMPACT_QUERY);
		setCompact(mql.matches);
		const listener = (event: MediaQueryListEvent) =>
			setCompact(event.matches);
		mql.addEventListener('change', listener);
		return () => mql.removeEventListener('change', listener);
	}, []);
	return compact;
};

/**
 * Everything that follows from one mini-clock diameter. Kept in one place so the
 * flip card, the fit calculation and the grid all agree on the same numbers.
 *
 * `tight` is Frank's "alle ganz nah beieinander": every gap — between cells,
 * between the two digits, between the four groups — is the cell gap, so the
 * whole clock is one continuous lattice. Otherwise the digits and groups get a
 * little air (35 % / 55 % of a cell), which is the "ein ganz bisschen Spacing"
 * variant he also wanted to see.
 *
 * `compact` (phone) forces the tight lattice and shrinks the label band from
 * `labelFont + 8` to `labelFont + 2`: on a phone the air between a number group
 * and its label was space the clock itself could have. The cell gap keeps its
 * formula — `ClockDigits` derives its own grid gap from it, and the two must
 * never drift apart.
 */
const clockGeometry = (size: number, tight: boolean, compact = false) => {
	const cellGap = Math.max(2, Math.round(size * 0.1));
	const lattice = tight || compact;
	const digitGap = lattice ? cellGap : Math.round(size * 0.35);
	const groupGap = lattice ? cellGap : Math.round(size * 0.55);
	// Labels grow with the clock, within reason: 10 px on a phone, 13 px on
	// a desktop-sized block.
	const labelFont = compact
		? Math.max(9, Math.min(11, Math.round(size * 0.24)))
		: Math.max(10, Math.min(13, Math.round(size * 0.27)));
	const labelH = labelFont + (compact ? 2 : 8);
	const digitW = size * 4 + cellGap * 3;
	const groupH = size * 6 + cellGap * 5 + labelH;
	return {
		cellGap,
		digitGap,
		groupGap,
		labelFont,
		labelH,
		digitW,
		groupH
	};
};

type ClockGeometry = ReturnType<typeof clockGeometry>;

/**
 * Width of one number group. It is not a constant of the geometry: a group
 * showing 140 minutes is three digit cells wide, one showing 7 is two (#1499).
 * Everything that reserves room for a group has to ask for its digit count,
 * otherwise the budget and the rendered row disagree — which is exactly how
 * the seconds group ended up on a second row.
 */
export const groupWidth = (geometry: ClockGeometry, digits: number) =>
	digits * geometry.digitW + (digits - 1) * geometry.digitGap;

/**
 * The column the overdue "+" occupies, pinned in `waitingAreaCountdown.styles`
 * as a hard `width` on `.waitingClock__plus`.
 *
 * It used to be a guess at how wide the glyph renders, and the guess was wrong
 * in both directions: the 34 px phone "+" measures 22 px (#1499 round 1, fixed
 * for 390) and the 64 px desktop one measures 41.8 px against a 28 px budget.
 * At 1440 that put the row at 809.8 px inside an 800 px column, the seconds
 * group wrapped and painted over the caption below the fixed-height flip card.
 * Pinning the box instead of measuring the glyph makes the two agree by
 * construction, in any font.
 */
export const PLUS_BOX = { compact: 24, wide: 44 };
const PLUS_GAP = { compact: 10, wide: 28 };

/** Width the "+" and the flex gaps around it take from the number groups. */
const overdueSignWidth = (compact: boolean) =>
	compact
		? PLUS_BOX.compact + 2 * PLUS_GAP.compact
		: PLUS_BOX.wide + 2 * PLUS_GAP.wide;

/** What the layout has to fit into: how the clock is drawn and what it shows. */
export interface ClockShape {
	/** The counting-up state: "+", minutes, seconds on one row. */
	overdue: boolean;
	/** One continuous lattice instead of a little air between the groups. */
	tight: boolean;
	/** Phone geometry (below `$fromMedium`). */
	compact: boolean;
	/** Digit count of each rendered group, left to right. */
	digits: number[];
}

/**
 * The width the clock really occupies at mini-clock diameter `size`.
 *
 * Single source of truth: `fitClockSize` searches with it, and the layout
 * tests assert against it. The wrap in #1499 was exactly the gap between a
 * budget that lived here and the pixels the browser actually laid out.
 */
export const clockRowWidth = (
	size: number,
	{ overdue, tight, compact, digits }: ClockShape
) => {
	const g = clockGeometry(size, tight, compact);
	return overdue
		? digits.reduce((sum, n) => sum + groupWidth(g, n), 0) +
				overdueSignWidth(compact)
		: // The future 2x2 grid sizes both of its columns by the widest group,
			// because `grid-template-columns: repeat(2, auto)` does the same.
			2 * groupWidth(g, Math.max(...digits)) + g.groupGap;
};

/** The height the clock occupies at mini-clock diameter `size`. */
export const clockRowHeight = (size: number, shape: ClockShape) => {
	const g = clockGeometry(size, shape.tight, shape.compact);
	return shape.overdue ? g.groupH : 2 * g.groupH + g.groupGap;
};

/**
 * The largest mini-clock that still lets the whole clock fit the given box.
 * Walks down from the maximum; the first size that fits wins. Width alone
 * decides when no height is given.
 */
export const fitClockSize = (
	width: number,
	height: number | undefined,
	shape: ClockShape
) => {
	for (let size = FIT_MAX_SIZE; size >= FIT_MIN_SIZE; size--) {
		if (
			clockRowWidth(size, shape) <= width &&
			(height === undefined || clockRowHeight(size, shape) <= height)
		) {
			return size;
		}
	}
	return FIT_MIN_SIZE;
};

/**
 * "Animation abschalten" — the waiting room's motion switch. Exported so a
 * screen that hides the built-in one (`hideMotionToggle`) can place the same
 * control elsewhere, e.g. in its footer next to the main action (#1499).
 */
export const WaitingAreaMotionToggle = ({
	label,
	checked,
	disabled = false,
	onChange
}: {
	label: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) => (
	<label
		style={{
			display: 'flex',
			alignItems: 'center',
			gap: 10,
			fontSize: 12,
			color: MUTED,
			cursor: disabled ? 'default' : 'pointer',
			opacity: disabled ? 0.6 : 1
		}}
	>
		{label}
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			style={{
				width: 46,
				height: 26,
				borderRadius: 13,
				border: checked
					? `2px solid ${RED}`
					: '2px solid var(--m3-outline, #747878)',
				background: checked
					? RED
					: 'var(--m3-surface-container-high, #eae7e8)',
				position: 'relative',
				cursor: disabled ? 'default' : 'pointer',
				padding: 0,
				transition: 'all .25s',
				flexShrink: 0
			}}
		>
			<span
				style={{
					position: 'absolute',
					top: checked ? 1 : 3,
					left: checked ? 21 : 3,
					width: checked ? 20 : 16,
					height: checked ? 20 : 16,
					borderRadius: '50%',
					background: checked ? '#fff' : MUTED,
					transition: 'all .25s'
				}}
			/>
		</button>
	</label>
);

export interface WaitingAreaCountdownProps {
	/** When the group chat is scheduled to start. */
	plannedStart: Date;
	/** Personal greeting from the counsellor (first page behind the clock). */
	welcomeText?: string;
	/** Netiquette rules (one page each behind the clock). */
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
	 * 2026-09-04 variants; he wanted to see them side by side. On a phone the
	 * clock is always tight — there `airy` costs more than it gives.
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
	/**
	 * Controlled "Animation abschalten" state. When `onAnimationOffChange` is
	 * set, the parent owns the switch so siblings (rules) can pause too (#1293).
	 */
	animationOff?: boolean;
	/**
	 * Who is waiting. `moderator` is the counsellor who opens the room: she
	 * gets her own headline and subline instead of the participants' "we'll be
	 * with you in a moment" (#1499). Default `participant`.
	 */
	audience?: 'participant' | 'moderator';
	onAnimationOffChange?: (off: boolean) => void;
	/**
	 * Vertical gap between headline, clock and the rest, in px. Default 26.
	 * The entry room passes less: every pixel of chrome is one the clock
	 * cannot have (Frank, 2026-09-05: "maximal groß innerhalb des weißen
	 * Bereichs").
	 */
	gap?: number;
}

interface Unit {
	key: string;
	label: string;
	value: number;
}

/** One readable page on the back of the card. */
interface BackPage {
	key: string;
	greeting: boolean;
	label: string;
	text: string;
}

/**
 * The self-help group-chat waiting area (ORISO Design variant 4a/4b) — everything
 * inside the white box: headline, add-to-calendar, the "clock made of clocks",
 * and the one large flip card the whole clock sits on. A click, a tap or
 * Enter/Space turns the block over; the back carries the counsellor's greeting
 * and the netiquette, one page at a time, paged with arrow buttons. Once the
 * planned start has passed it counts up (error tint, leading "+", smileys popping
 * into single mini-clocks). Renders into the real JoinGroupChatView; it does not
 * draw the surrounding app shell.
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
	animationOff: animationOffProp,
	audience = 'participant',
	onAnimationOffChange,
	gap = 26,
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
	const compact = useCompactViewport();
	const [tick, setTick] = React.useState(() => nowMs ?? Date.now());
	const [uncontrolledAnimOff, setUncontrolledAnimOff] = React.useState(false);
	const animOffControlled = onAnimationOffChange !== undefined;
	const animOff = animOffControlled
		? Boolean(animationOffProp)
		: uncontrolledAnimOff;
	const setAnimOff = animOffControlled
		? onAnimationOffChange
		: setUncontrolledAnimOff;
	const [cardOpen, setCardOpen] = React.useState(false);
	const [page, setPage] = React.useState(0);
	const [cardHover, setCardHover] = React.useState(false);
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
	// Measured for `clockSize="fit"`, and for a fixed `clockSize` too, where it
	// only ever clamps the given number down to what the column can hold. A
	// hard-coded 30 px mini-clock is 522 px of digits, which no 375 pt screen
	// has — and 678 px once the minutes group needs a third digit, which the
	// counsellor's 768 px waiting box does not have either (#1499). The clamp
	// used to be a phone-only rule; a fixed number is never right for every
	// content, not just for every screen.
	React.useEffect(() => {
		if (!rootRef.current) {
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
	const rem = Math.max(0, remaining);
	const d = Math.floor(rem / 86400);
	const h = Math.floor(rem / 3600) % 24;
	const m = Math.floor(rem / 60) % 60;
	const s = Math.floor(rem) % 60;
	const elapsed = Math.max(0, -remaining);
	// Total elapsed minutes — an hour-late chat must read 60+, never wrap to 0.
	const oM = Math.floor(elapsed / 60);
	const oS = Math.floor(elapsed) % 60;
	/* The numbers come before the size, not after it: how wide the clock is
	   depends on how many digit cells the values need, and only the values
	   know that. Hours, minutes and seconds are always two — days and overdue
	   minutes are the two that can reach three (#1499). */
	const faceWidths = isOverdue
		? [faceDigitCount(oM), faceDigitCount(oS)]
		: [faceDigitCount(d), 2];
	const shape: ClockShape = {
		overdue: isOverdue,
		tight,
		compact,
		digits: faceWidths
	};
	const size =
		clockSize === 'fit'
			? measuredWidth === null
				? CLOCK_SIZE
				: fitClockSize(measuredWidth, fitHeight, shape)
			: measuredWidth !== null
				? Math.min(
						clockSize,
						fitClockSize(measuredWidth, undefined, shape)
					)
				: clockSize;
	const geo = clockGeometry(size, tight, compact);
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
			setPop((current) => {
				if (current) {
					return null;
				}
				const group = Math.random() < 0.5 ? 'om' : 'os';
				// Three-digit groups have a third cell to pop in, too.
				const cells = group === 'om' ? faceWidths[0] : faceWidths[1];
				return {
					group,
					digit: Math.floor(Math.random() * cells),
					cell: Math.floor(Math.random() * 24),
					emoji: overdueEmoji
				};
			});
		}, POP_INTERVAL_MS);
		return () => window.clearInterval(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOverdue, motionless, overdueEmoji, faceWidths[0], faceWidths[1]]);

	const greetingLabel = tr('greetingLabel', 'Begrüßung deiner Beratung');

	/**
	 * The back of the card, page by page: the greeting first, then one page per
	 * netiquette rule. Frank, 2026-09-07: "Die Karten sind zu klein … eine große
	 * Flipkarte … die Begrüßung und die Netiquette darunter, am besten mit
	 * klickbaren Rechts-Links-Pfeilen." One rule per page is what keeps a long
	 * sentence whole at 375 px — the back grows to its text, it never cuts it.
	 */
	const pages: BackPage[] = React.useMemo(() => {
		const list: BackPage[] = [];
		if (welcomeText) {
			list.push({
				key: 'greeting',
				greeting: true,
				label: greetingLabel,
				text: welcomeText
			});
		}
		rules.forEach((rule, index) =>
			list.push({
				key: `rule-${index}`,
				greeting: false,
				label: tr(
					'netiquetteLabel',
					`Netiquette · Regel ${index + 1}`,
					{ no: index + 1 }
				),
				text: rule
			})
		);
		return list;
	}, [welcomeText, rules, greetingLabel, tr]);

	const canFlip = pages.length > 0;
	const pageCount = pages.length;
	const currentPage = pages[Math.min(page, Math.max(0, pageCount - 1))];

	const openCard = () => {
		setPage(0);
		setCardOpen(true);
	};
	const closeCard = () => setCardOpen(false);
	const flipped = cardOpen && canFlip;

	const toggleLabel = tr('toggleLabel', 'Animation abschalten');
	const toggle = (
		<WaitingAreaMotionToggle
			label={toggleLabel}
			checked={motionless}
			disabled={forcedMotionless}
			onChange={setAnimOff}
		/>
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
	const moderator = audience === 'moderator';
	const headline = moderator
		? isOverdue
			? tr('moderatorOverdueHeadline', 'Die Gruppe wartet.')
			: tr('moderatorHeadline', `Der Gesprächskreis beginnt ${eta}.`, {
					eta
				})
		: isOverdue
			? tr('overdueHeadline', 'Wir sind gleich für dich da.')
			: tr('headline', `Dein Gruppen-Chat beginnt ${eta}.`, { eta });
	// Frank, 2026-09-07: "statt zu sagen hey dieser Bindestrich ist quasi,
	// kannst auch ein Komma machen" — and nobody clicks "a number" any more,
	// there is one card now. Short enough to hold one line at 375 px.
	const subtitle = moderator
		? tr(
				'moderatorSubtitle',
				'Sie können den Chat starten, sobald Sie bereit sind.'
			)
		: isOverdue
			? tr(
					'overdueSubtitle',
					'Deine Beratung öffnet den Raum gleich — bitte hab noch einen Moment Geduld.'
				)
			: canFlip
				? tr(
						'subtitleCard',
						'Uhr antippen, dahinter Begrüßung und Netiquette.'
					)
				: '';
	// The still view keeps the clock's footprint, so the row under it and the
	// bar never move when someone flips the switch (Frank, 2026-09-04: "er
	// sollte auf jeden Fall nicht springen").
	const clockFootprint = isOverdue
		? geo.groupH
		: 2 * geo.groupH + geo.groupGap;

	const units: Array<{ unit: Unit; tint?: boolean }> = isOverdue
		? [
				{
					unit: {
						key: 'om',
						label: tr('unitMinutes', 'Minuten'),
						value: oM
					},
					tint: true
				},
				{
					unit: {
						key: 'os',
						label: tr('unitSeconds', 'Sekunden'),
						value: oS
					},
					tint: true
				}
			]
		: [
				{ unit: { key: 'd', label: tr('unitDays', 'Tage'), value: d } },
				{
					unit: {
						key: 'h',
						label: tr('unitHours', 'Stunden'),
						value: h
					}
				},
				{
					unit: {
						key: 'm',
						label: tr('unitMinutes', 'Minuten'),
						value: m
					}
				},
				{
					unit: {
						key: 's',
						label: tr('unitSeconds', 'Sekunden'),
						value: s
					}
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
		<div aria-hidden="true" className="waitingClock__plus">
			+
		</div>
	);

	const overdueCaption = isOverdue && (
		<div
			// The clock must never be drawn over this line; the class is how
			// the layout stories find it in any language (#1499).
			className="waitingClock__overdueCaption"
			style={{
				alignSelf: 'center',
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				// The same pale brand tint the overdue mini-clocks carry, so
				// the note belongs to the clock in every Träger theme instead
				// of staying Caritas pink under a blue one (#1499).
				background: TINT,
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

	/** One number group — two "clock made of clocks" digits plus their label. */
	const numberGroup = (
		unit: Unit,
		options: { tint?: boolean; labelAbove?: boolean }
	) => {
		const label = (
			<div
				style={{
					height: geo.labelH,
					display: 'flex',
					alignItems: 'center',
					fontSize: geo.labelFont,
					fontWeight: 600,
					lineHeight: 1,
					letterSpacing: '.16em',
					textTransform: 'uppercase',
					color: cardHover ? RED : MUTED,
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
		return (
			<div
				key={unit.key}
				style={{
					width: groupWidth(geo, faceDigitCount(unit.value)),
					height: geo.groupH,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					// The fit already reserved this width; letting the flex row
					// shrink it would squash the lattice instead (#1499).
					flexShrink: 0
				}}
			>
				{options.labelAbove && label}
				<ClockDigits
					value={unit.value}
					size={size}
					digitGap={geo.digitGap}
					// Frank, 2026-09-07: "Der Gravity-Effekt kann auf dem
					// Mobiltelefon abgeschaltet werden." There is no cursor to
					// attract on a phone anyway.
					magnet={!compact}
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
				{!options.labelAbove && label}
			</div>
		);
	};

	const clockGrid = isOverdue ? (
		<div className="waitingClock__timerOverdue">
			{plusSign}
			{units.map(({ unit, tint }) => numberGroup(unit, { tint }))}
		</div>
	) : (
		<div
			className="waitingClock__timer"
			// The stylesheet's gap is the default; the geometry decides here so
			// the four groups keep the same rhythm as the cells.
			style={{ gap: geo.groupGap }}
		>
			{units.map(({ unit }, index) =>
				numberGroup(unit, {
					labelAbove: labelsOutside && index < 2
				})
			)}
		</div>
	);

	const backToClock = tr('cardBack', 'Zurück zur Uhr');
	// The back is as wide as the clock it replaces, so its type grows with the
	// clock: 15 px on a phone, up to 19 px on a desktop block.
	/* The card is as wide as the clock it replaces, so on a 1440 desktop it is
	   a very large surface for one sentence. The type grows with it — up to
	   30 px — and the line stays inside a reading width, otherwise the text
	   floats lost in the middle of the card (Frank, 2026-09-07: "kannst dir
	   hier auch ein bisschen mehr Mühe geben im Design"). */
	const textFont = Math.round(Math.min(30, Math.max(15, size * 0.62)));
	const navButtonSx = {
		'color': '#fff',
		'&.Mui-disabled': { color: 'rgba(255,255,255,.35)' }
	} as const;

	const backSide = currentPage && (
		<div
			className="waitingClock__back"
			style={{ background: currentPage.greeting ? RED : DARK }}
		>
			<div className="waitingClock__backHead">
				<span
					className="waitingClock__backLabel"
					style={{
						fontSize: Math.max(10, geo.labelFont),
						color: currentPage.greeting
							? 'rgba(255,255,255,.78)'
							: PINK
					}}
				>
					{currentPage.label}
				</span>
				<Button
					size="small"
					startIcon={<CloseRoundedIcon />}
					onClick={closeCard}
					tabIndex={flipped ? 0 : -1}
					sx={{
						color: '#fff',
						flexShrink: 0,
						fontSize: 12,
						textTransform: 'none',
						minWidth: 0
					}}
				>
					{backToClock}
				</Button>
			</div>
			<div
				className="waitingClock__backText"
				style={{
					fontSize: currentPage.greeting ? textFont + 1 : textFont,
					fontWeight: currentPage.greeting ? 600 : 500,
					maxWidth: '32ch',
					marginInline: 'auto'
				}}
			>
				{currentPage.text}
			</div>
			{pageCount > 1 && (
				<div className="waitingClock__backNav">
					<IconButton
						size="small"
						aria-label={tr('cardPrev', 'Vorherige Seite')}
						disabled={page === 0}
						tabIndex={flipped ? 0 : -1}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						sx={navButtonSx}
					>
						<ChevronLeftRoundedIcon />
					</IconButton>
					<span className="waitingClock__backPage">
						{tr('cardPage', `${page + 1} von ${pageCount}`, {
							current: page + 1,
							total: pageCount
						})}
					</span>
					<IconButton
						size="small"
						aria-label={tr('cardNext', 'Nächste Seite')}
						disabled={page >= pageCount - 1}
						tabIndex={flipped ? 0 : -1}
						onClick={() =>
							setPage((p) => Math.min(pageCount - 1, p + 1))
						}
						sx={navButtonSx}
					>
						<ChevronRightRoundedIcon />
					</IconButton>
				</div>
			)}
		</div>
	);

	// One big card: the whole clock is the front, one back side carries the
	// greeting and the netiquette. The visible face is the one in normal flow,
	// the hidden one is taken out of it — that way the card is never shorter
	// than the text it shows and no sentence is ever cut off.
	const flipCard = (
		<div
			className="waitingClock__card"
			style={{
				minHeight: clockFootprint,
				height: flipped ? 'auto' : clockFootprint
			}}
		>
			<div
				className="waitingClock__cardInner"
				style={{
					minHeight: clockFootprint,
					transform: `rotateY(${flipped ? 180 : cardHover ? -6 : 0}deg)`
				}}
			>
				<div
					className="waitingClock__cardFace"
					aria-hidden={flipped}
					style={{
						position: flipped ? 'absolute' : 'relative',
						inset: flipped ? 0 : undefined,
						overflow: flipped ? 'hidden' : undefined,
						opacity: flipped ? 0 : 1
					}}
				>
					<div
						role="button"
						tabIndex={flipped ? -1 : 0}
						aria-pressed={flipped}
						aria-label={tr(
							'cardOpenAria',
							'Uhr umdrehen, Begrüßung und Netiquette lesen'
						)}
						onClick={openCard}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openCard();
							}
						}}
						onMouseEnter={() => setCardHover(true)}
						onMouseLeave={() => setCardHover(false)}
						onFocus={() => setCardHover(true)}
						onBlur={() => setCardHover(false)}
						className="waitingClock__cardFront"
					>
						{clockGrid}
					</div>
				</div>
				<div
					className="waitingClock__cardFace waitingClock__cardFace--back"
					aria-hidden={!flipped}
					style={{
						position: flipped ? 'relative' : 'absolute',
						inset: flipped ? undefined : 0,
						overflow: flipped ? undefined : 'hidden',
						opacity: flipped ? 1 : 0
					}}
				>
					{backSide}
				</div>
			</div>
		</div>
	);

	const stillCell = (unit: Unit, tint?: boolean) => (
		<div
			key={unit.key}
			className={`waitingClock__stillCell${
				tint ? ' waitingClock__stillCell--tint' : ''
			}`}
		>
			<span className="waitingClock__stillValue">
				{faceDigits(unit.value).join('')}
			</span>
			<span className="waitingClock__stillLabel">{unit.label}</span>
		</div>
	);

	return (
		<div
			ref={rootRef}
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap,
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
						fontSize: 'clamp(22px, 2vw, 28px)',
						lineHeight: 1.2,
						fontWeight: 700,
						letterSpacing: '-0.01em',
						textWrap: 'balance'
					}}
				>
					{headline}
				</div>
				{subtitle && (
					<div
						style={{
							fontSize: 'clamp(13px, 1.1vw, 15px)',
							color: MUTED
						}}
					>
						{subtitle}
					</div>
				)}
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
					{/* Frank, 2026-09-07: "könntest du ja auch trotzdem ein
					    bisschen grafischer anordnen als Quadrat … die kann ja
					    auch trotzdem größer sein." A 2×2 square of tiles in the
					    same neumorphic language as the mini-clocks — and with
					    no transition or animation anywhere, because not moving
					    is the entire point of this view.

					    Greeting and netiquette used to stand stacked under the
					    numbers here. That made the still view a head taller
					    than the moving one and pushed the screen into a scroll
					    (measured 2026-09-07: 1001 px of page in an 812 px
					    window). They now sit behind the same one card the
					    moving view uses — opened by tapping the numbers,
					    swapped without any transition. */}
					{cardOpen && canFlip ? (
						<div
							className="waitingClock__stillBack"
							style={{ minHeight: clockFootprint }}
						>
							{backSide}
						</div>
					) : (
						<div
							role="timer"
							aria-label={timerAria}
							className={`waitingClock__still${
								isOverdue ? ' waitingClock__still--overdue' : ''
							}`}
						>
							{isOverdue && (
								<div
									aria-hidden="true"
									className="waitingClock__stillPlus"
								>
									+
								</div>
							)}
							{units.map(({ unit, tint }) =>
								stillCell(unit, tint)
							)}
							{/* The way to the card is its own control. It used
							    to be `role="button"` on this container, which
							    made the numbers its accessible name and hid the
							    four tiles from a screen reader — the opposite of
							    what the still view is for. */}
							{canFlip && (
								<Button
									variant="text"
									size="small"
									onClick={openCard}
									className="waitingClock__stillOpen"
								>
									{tr(
										'cardOpenAria',
										'Begrüßung und Netiquette anzeigen'
									)}
								</Button>
							)}
						</div>
					)}
				</div>
			) : (
				<div
					role="timer"
					aria-label={timerAria}
					style={{ minWidth: 0 }}
				>
					{canFlip ? flipCard : clockGrid}
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
