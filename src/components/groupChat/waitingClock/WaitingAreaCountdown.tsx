import * as React from 'react';
import { ClockDigits } from './ClockDigits';

/** ORISO red + the design palette used inside the white waiting box. */
const RED = '#CC1E1C';
const DARK = '#374151';
const MUTED = '#646D78';

export interface WaitingRule {
	no: string;
	title: string;
	text: string;
}

export interface WaitingAreaCountdownProps {
	/** When the group chat is scheduled to start. */
	plannedStart: Date;
	/** Personal greeting from the counsellor (behind the "Tage" number). */
	welcomeText: string;
	/** Netiquette rules (behind the other numbers). */
	rules: WaitingRule[];
	/** Start in the calm, motion-free state (also driven by the toggle / OS). */
	reducedMotion?: boolean;
	/** Fixed "now" for tests/stories; defaults to a live 1s tick. */
	nowMs?: number;
	/** Add-to-calendar action (ICS). Hidden when omitted. */
	onAddToCalendar?: () => void;
}

interface Unit {
	key: string;
	label: string;
	value: number;
}

const humanEta = (d: number, h: number, m: number): string => {
	if (d > 0) return `in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
	if (h > 0) return `in ${h} ${h === 1 ? 'Stunde' : 'Stunden'}`;
	if (m > 0) return `in ${m} ${m === 1 ? 'Minute' : 'Minuten'}`;
	return 'gleich';
};

/**
 * The self-help group-chat waiting area (ORISO Design variant 4a) — everything
 * inside the white box: headline, add-to-calendar, the "clock made of clocks"
 * whose number groups flip on click to reveal the counsellor's greeting (behind
 * the days) and the netiquette rules (behind hours/minutes/seconds), plus the
 * "switch off animation" toggle. Renders into the real JoinGroupChatView; it does
 * not draw the surrounding app shell.
 */
export const WaitingAreaCountdown = ({
	plannedStart,
	welcomeText,
	rules,
	reducedMotion = false,
	nowMs,
	onAddToCalendar
}: WaitingAreaCountdownProps) => {
	const [tick, setTick] = React.useState(() => nowMs ?? Date.now());
	const [animOff, setAnimOff] = React.useState(reducedMotion);
	const [flips, setFlips] = React.useState<Record<string, boolean>>({});
	const [backRule, setBackRule] = React.useState<Record<string, number>>({});
	const [hover, setHover] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (nowMs !== undefined) {
			setTick(nowMs);
			return undefined;
		}
		const t = window.setInterval(() => setTick(Date.now()), 1000);
		return () => window.clearInterval(t);
	}, [nowMs]);

	const motionless = animOff || reducedMotion;
	const remaining = (plannedStart.getTime() - tick) / 1000;
	const isOverdue = remaining <= 0;
	const rem = Math.max(0, remaining);
	const d = Math.floor(rem / 86400);
	const h = Math.floor(rem / 3600) % 24;
	const m = Math.floor(rem / 60) % 60;
	const s = Math.floor(rem) % 60;

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

	const backCard = (key: string, isRule: boolean) => {
		const label = isRule
			? `NETTIKETTE · REGEL ${rules[backRule[key] ?? 0]?.no ?? ''}`
			: 'BEGRÜSSUNG DEINER BERATERIN';
		const text = isRule
			? (rules[backRule[key] ?? 0]?.text ?? '')
			: welcomeText;
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
						color: '#FFB3BA'
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

	const flipGroup = (unit: Unit, isRule: boolean, size: number) => {
		const flipped = !!flips[unit.key];
		const isHover = hover === unit.key;
		// Box must fit two clock-made-of-clocks digits (each 4×6 cells) plus label.
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
				<ClockDigits value={unit.value} size={size} />
				<div
					style={{
						fontSize: 10,
						fontWeight: 600,
						letterSpacing: '.16em',
						color: isHover ? RED : '#9AA1A9',
						transition: 'color .25s'
					}}
				>
					{unit.label.toUpperCase()}
				</div>
			</>
		);
		return (
			<div
				key={unit.key}
				role="button"
				tabIndex={0}
				aria-label={`${unit.label}: ${unit.value}. Umdrehen zum Lesen.`}
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
					{unit.label} · klicken zum Umdrehen
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

	const toggle = (
		<label
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				fontSize: 12,
				color: DARK,
				cursor: 'pointer'
			}}
		>
			Animation abschalten
			<button
				type="button"
				role="switch"
				aria-checked={animOff}
				aria-label="Animation abschalten"
				onClick={() => setAnimOff((v) => !v)}
				style={{
					width: 46,
					height: 26,
					borderRadius: 13,
					border: animOff ? `2px solid ${RED}` : '2px solid #A6AEB8',
					background: animOff ? RED : '#ECEDEF',
					position: 'relative',
					cursor: 'pointer',
					padding: 0,
					transition: 'all .25s',
					flexShrink: 0
				}}
			>
				<span
					style={{
						position: 'absolute',
						top: animOff ? 1 : 3,
						left: animOff ? 21 : 3,
						width: animOff ? 20 : 16,
						height: animOff ? 20 : 16,
						borderRadius: '50%',
						background: animOff ? '#fff' : '#646D78',
						transition: 'all .25s'
					}}
				/>
			</button>
		</label>
	);

	const headline = isOverdue
		? 'Wir sind gleich für dich da.'
		: `Dein Gruppen-Chat beginnt ${humanEta(d, h, m)}.`;
	const subtitle = isOverdue
		? 'Deine Beratung öffnet den Raum gleich — bitte hab noch einen Moment Geduld.'
		: 'Klick auf eine Zahl — dahinter warten Begrüßung und Nettikette.';

	const futureUnits: Array<{ unit: Unit; rule: boolean }> = [
		{ unit: { key: 'd', label: 'Tage', value: d }, rule: false },
		{ unit: { key: 'h', label: 'Stunden', value: h }, rule: true },
		{ unit: { key: 'm', label: 'Minuten', value: m }, rule: true },
		{ unit: { key: 's', label: 'Sekunden', value: s }, rule: true }
	];

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 26,
				fontFamily: 'Inter, system-ui, sans-serif',
				color: '#1A1A1A'
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
				{onAddToCalendar && !isOverdue && (
					<button
						type="button"
						onClick={onAddToCalendar}
						style={{
							alignSelf: 'center',
							marginTop: 10,
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							background: '#FBDDDD',
							color: '#8C1513',
							border: 'none',
							borderRadius: 20,
							padding: '10px 18px',
							fontFamily: 'inherit',
							fontSize: 13,
							fontWeight: 600,
							cursor: 'pointer'
						}}
					>
						Zum Kalender hinzufügen
					</button>
				)}
			</div>

			{motionless ? (
				<div
					role="timer"
					aria-label={
						isOverdue
							? `Seit dem geplanten Beginn: ${m} Minuten ${s} Sekunden`
							: `Noch ${d} Tage, ${h} Stunden, ${m} Minuten, ${s} Sekunden`
					}
					style={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: 24,
						justifyContent: 'center',
						fontVariantNumeric: 'tabular-nums'
					}}
				>
					{futureUnits.map(({ unit }) => (
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
									color: '#9AA1A9'
								}}
							>
								{unit.label.toUpperCase()}
							</div>
						</div>
					))}
				</div>
			) : (
				<div
					role="timer"
					aria-label={`Noch ${d} Tage, ${h} Stunden, ${m} Minuten, ${s} Sekunden bis zum Beginn`}
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, auto)',
						gap: '30px 36px',
						justifyContent: 'center'
					}}
				>
					{futureUnits.map(({ unit, rule }) =>
						flipGroup(unit, rule, 30)
					)}
				</div>
			)}

			{motionless && (
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
							background: '#F9FAFB',
							border: '1px solid #ECEDEF',
							borderRadius: 16,
							padding: '16px 18px'
						}}
					>
						<div
							style={{
								fontSize: 9.5,
								fontWeight: 700,
								letterSpacing: '.14em',
								color: MUTED
							}}
						>
							BEGRÜSSUNG DEINER BERATERIN
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
