import * as React from 'react';
import { digitCells, twoDigits } from './waitingClockDigits';

const HAND_COLOR = 'var(--m3-primary-container, #cc1e1c)';
const MAGNET_RADIUS_PX = 80;
const MAGNET_THROTTLE_MS = 70;

/** One cell of the grid temporarily replaced by a popping emoji (overdue fun). */
export interface ClockDigitsPop {
	/** Which of the two digits (0 = tens, 1 = ones). */
	digit: number;
	/** Cell index 0–23 inside that digit's 4×6 grid. */
	cell: number;
	emoji: string;
}

export interface ClockDigitsProps {
	/** 0–99, rendered as two "clock made of clocks" digits. */
	value: number;
	/** Diameter of one mini-clock in px. */
	size?: number;
	/** Static, motion-free fallback: big tabular Inter digits. */
	reducedMotion?: boolean;
	/** These digits are decorative (a label/aria elsewhere describes the value). */
	ariaHidden?: boolean;
	/** Warm error tint for the overdue state. */
	tint?: boolean;
	/** Mini-clocks near the cursor point their hands at it (fixed 80px radius). */
	magnet?: boolean;
	/** Cell currently showing a popped-in emoji instead of its clock. */
	pop?: ClockDigitsPop | null;
}

/**
 * Two "clock made of clocks" digits for one value (e.g. hours), no label/chrome.
 *
 * Hand angles accumulate forward-only across renders (a clock never rewinds) via
 * a ref, and the grid assembles from random start angles for ~0.9s on mount.
 * With `magnet`, mini-clocks within 80px of the cursor swing both hands towards
 * it (the design's playful magnet interaction). This is the shared primitive
 * behind the waiting-area countdown.
 */
export const ClockDigits = ({
	value,
	size = 30,
	reducedMotion = false,
	ariaHidden = true,
	tint = false,
	magnet = false,
	pop = null
}: ClockDigitsProps) => {
	const prev = React.useRef<Record<string, number>>({});
	const rand = React.useRef<Record<string, [number, number]>>({});
	const lastMove = React.useRef(0);
	const [initial, setInitial] = React.useState(!reducedMotion);
	const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(
		null
	);

	React.useEffect(() => {
		if (reducedMotion) {
			return undefined;
		}
		const t = window.setTimeout(() => setInitial(false), 900);
		return () => window.clearTimeout(t);
	}, [reducedMotion]);

	if (reducedMotion) {
		return (
			<div
				aria-hidden={ariaHidden}
				style={{
					fontSize: size * 1.8,
					fontWeight: 700,
					color: 'var(--m3-on-surface, #1a1c1e)',
					letterSpacing: '-0.02em',
					lineHeight: 1,
					fontVariantNumeric: 'tabular-nums'
				}}
			>
				{String(Math.max(0, Math.floor(value))).padStart(2, '0')}
			</div>
		);
	}

	// Advance `key` to `next` along the shortest forward path; idempotent for an
	// unchanged target so React StrictMode's double render stays stable.
	const advance = (key: string, next: number): number => {
		const p = prev.current[key] ?? 0;
		const v = p + ((((next - p) % 360) + 360) % 360);
		prev.current[key] = v;
		return v;
	};

	const thickness = size >= 20 ? 2.5 : 2;
	const length = size * 0.47;
	const gap = Math.max(2, Math.round(size * 0.1));
	const digitW = size * 4 + gap * 3;
	const digitGap = Math.round(size * 0.35);

	const renderCell = (
		key: string,
		digitIndex: number,
		cellIndex: number,
		h: number,
		m: number
	) => {
		const circle: React.CSSProperties = {
			position: 'relative',
			width: size,
			height: size,
			borderRadius: '50%',
			flexShrink: 0,
			border: '1.5px solid #fff',
			background: tint
				? 'linear-gradient(225deg,#f4c9c9 10%,#fff)'
				: 'linear-gradient(225deg,#dcdcdc 10%,#fff)',
			boxShadow: tint
				? '-2px 2px 5px #efc5c5,2px -2px 5px #ffffff'
				: '-2px 2px 5px #dcdcdc,2px -2px 5px #ffffff',
			boxSizing: 'border-box'
		};
		if (pop && pop.digit === digitIndex && pop.cell === cellIndex) {
			return (
				<div
					key={key}
					style={{
						...circle,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: size * 0.72,
						animation:
							'orisoClockPopIn .5s cubic-bezier(.34,1.56,.64,1) both'
					}}
				>
					{pop.emoji}
				</div>
			);
		}
		let ah: number;
		let am: number;
		let transition = initial
			? 'transform 1s ease-in-out'
			: 'transform .5s ease-in-out';
		// Cell centre inside this component's own box — the grid layout is fully
		// deterministic, so no per-cell rect measuring is needed.
		const cx =
			digitIndex * (digitW + digitGap) +
			(cellIndex % 4) * (size + gap) +
			size / 2;
		const cy = Math.floor(cellIndex / 4) * (size + gap) + size / 2;
		if (
			magnet &&
			cursor &&
			!initial &&
			Math.hypot(cursor.x - cx, cursor.y - cy) <= MAGNET_RADIUS_PX
		) {
			const theta =
				(Math.atan2(cursor.y - cy, cursor.x - cx) * 180) / Math.PI;
			ah = theta;
			am = theta;
			prev.current[`${key}h`] = theta;
			prev.current[`${key}m`] = theta;
			transition = 'transform .5s cubic-bezier(.34,1.45,.64,1)';
		} else if (initial) {
			if (!rand.current[key]) {
				rand.current[key] = [Math.random() * 360, Math.random() * 360];
			}
			[ah, am] = rand.current[key];
		} else {
			ah = advance(`${key}h`, h);
			am = advance(`${key}m`, m);
		}
		const hand = (angle: number, id: string) => (
			<div
				key={id}
				style={{
					position: 'absolute',
					top: size / 2 - thickness / 2,
					left: '50%',
					width: length,
					height: thickness,
					background: HAND_COLOR,
					borderRadius: 99,
					transformOrigin: '0% 50%',
					transform: `rotate(${angle}deg)`,
					transition
				}}
			/>
		);
		return (
			<div key={key} style={circle}>
				{hand(ah, 'h')}
				{hand(am, 'm')}
			</div>
		);
	};

	const renderDigit = (key: string, digitIndex: number, d: number) => (
		<div
			key={key}
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap,
				width: digitW
			}}
		>
			{digitCells(d).map((cell, i) =>
				renderCell(`${key}-${i}`, digitIndex, i, cell.h, cell.m)
			)}
		</div>
	);

	return (
		<div
			aria-hidden={ariaHidden}
			onMouseMove={
				magnet
					? (e) => {
							const now = performance.now();
							if (now - lastMove.current < MAGNET_THROTTLE_MS) {
								return;
							}
							lastMove.current = now;
							const rect =
								e.currentTarget.getBoundingClientRect();
							setCursor({
								x: e.clientX - rect.left,
								y: e.clientY - rect.top
							});
						}
					: undefined
			}
			onMouseLeave={magnet ? () => setCursor(null) : undefined}
			style={{ display: 'flex', gap: digitGap }}
		>
			{twoDigits(value).map((d, i) => renderDigit(`d${i}`, i, d))}
		</div>
	);
};
