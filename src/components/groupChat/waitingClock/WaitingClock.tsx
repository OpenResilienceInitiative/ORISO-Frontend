import * as React from 'react';
import { digitCells, twoDigits } from './waitingClockDigits';

/** ORISO red — the clock hands. Mirrors the design token used across group chat. */
const HAND_COLOR = '#CC1E1C';
const MUTED = '#9AA1A9';

export interface WaitingClockPart {
	/** Unit label, e.g. "Stunden". Shown under the group and in the aria-label. */
	label: string;
	/** 0–99, rendered as two clock-made-of-clocks digits. */
	value: number;
}

export interface WaitingClockProps {
	parts: WaitingClockPart[];
	/** Diameter of a single mini-clock in px. Drives the whole scale. */
	size?: number;
	/** 'quad' = 2×2 (days/hours/min/sec), 'row' = single line (overdue min/sec). */
	layout?: 'quad' | 'row';
	/** Prefix a large "+" (overdue counting up). */
	plus?: boolean;
	/** Static, calm fallback: big Inter digits, no animation (toggle or OS setting). */
	reducedMotion?: boolean;
	ariaLabel: string;
}

const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/**
 * The waiting-area countdown rendered as a "clock made of clocks".
 *
 * Hand angles are interpolated forward-only across renders (a clock never spins
 * backwards) via a ref, and the grid assembles from random angles on mount.
 * When `reducedMotion` is set it renders plain tabular Inter digits instead —
 * the accessible, motion-free equivalent.
 */
export const WaitingClock = ({
	parts,
	size = 30,
	layout = 'quad',
	plus = false,
	reducedMotion = false,
	ariaLabel
}: WaitingClockProps) => {
	// Persistent, ever-increasing hand angles per cell (forward-only rotation),
	// and the one-off random start angles for the assemble-in intro.
	const prev = React.useRef<Record<string, number>>({});
	const rand = React.useRef<Record<string, [number, number]>>({});
	const [initial, setInitial] = React.useState(true);

	React.useEffect(() => {
		if (reducedMotion) {
			return undefined;
		}
		const t = window.setTimeout(() => setInitial(false), 900);
		return () => window.clearTimeout(t);
	}, [reducedMotion]);

	// Advance `key` to `next` along the shortest *forward* path. Idempotent for an
	// unchanged target, so React StrictMode's double-render stays stable.
	const advance = (key: string, next: number): number => {
		const p = prev.current[key] ?? 0;
		const delta = (((next - p) % 360) + 360) % 360;
		const v = p + delta;
		prev.current[key] = v;
		return v;
	};

	const renderCell = (key: string, h: number, m: number) => {
		const handThickness = size >= 20 ? 2.5 : 2;
		const handLength = size * 0.47;
		let ah: number;
		let am: number;
		if (initial) {
			if (!rand.current[key]) {
				rand.current[key] = [Math.random() * 360, Math.random() * 360];
			}
			[ah, am] = rand.current[key];
		} else {
			ah = advance(`${key}h`, h);
			am = advance(`${key}m`, m);
		}
		const transition = initial
			? 'transform 1s ease-in-out'
			: 'transform .5s ease-in-out';
		const hand = (angle: number, id: string) => (
			<div
				key={id}
				style={{
					position: 'absolute',
					top: size / 2 - handThickness / 2,
					left: '50%',
					width: handLength,
					height: handThickness,
					background: HAND_COLOR,
					borderRadius: 99,
					transformOrigin: '0% 50%',
					transform: `rotate(${angle}deg)`,
					transition
				}}
			/>
		);
		return (
			<div
				key={key}
				style={{
					position: 'relative',
					width: size,
					height: size,
					borderRadius: '50%',
					flexShrink: 0,
					border: '1.5px solid #fff',
					background: 'linear-gradient(225deg,#dcdcdc 10%,#fff)',
					boxShadow: '-2px 2px 5px #dcdcdc,2px -2px 5px #ffffff',
					boxSizing: 'border-box'
				}}
			>
				{hand(ah, 'h')}
				{hand(am, 'm')}
			</div>
		);
	};

	const renderDigit = (key: string, d: number) => {
		const gap = Math.max(2, Math.round(size * 0.1));
		return (
			<div
				key={key}
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap,
					width: size * 4 + gap * 3
				}}
			>
				{digitCells(d).map((cell, i) =>
					renderCell(`${key}-${i}`, cell.h, cell.m)
				)}
			</div>
		);
	};

	const renderGroup = (key: string, part: WaitingClockPart) => (
		<div
			key={key}
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 7
			}}
		>
			<div style={{ display: 'flex', gap: Math.round(size * 0.35) }}>
				{twoDigits(part.value).map((d, i) =>
					renderDigit(`${key}-d${i}`, d)
				)}
			</div>
			<div
				style={{
					fontSize: 10,
					fontWeight: 600,
					letterSpacing: '.16em',
					color: MUTED
				}}
			>
				{part.label.toUpperCase()}
			</div>
		</div>
	);

	// Motion-free, calm equivalent — big tabular Inter digits.
	if (reducedMotion) {
		const big = layout === 'quad';
		return (
			<div
				role="timer"
				aria-label={ariaLabel}
				style={{
					display: 'flex',
					alignItems: 'baseline',
					gap: big ? 18 : 12,
					justifyContent: 'center',
					fontVariantNumeric: 'tabular-nums'
				}}
			>
				{plus && (
					<div
						style={{
							fontSize: big ? 54 : 42,
							fontWeight: 300,
							color: HAND_COLOR
						}}
					>
						+
					</div>
				)}
				{parts.map((p) => (
					<div
						key={p.label}
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: 4
						}}
					>
						<div
							style={{
								fontSize: big ? 54 : 42,
								fontWeight: 700,
								color: '#1A1A1A',
								letterSpacing: '-0.02em',
								lineHeight: 1
							}}
						>
							{pad2(p.value)}
						</div>
						<div
							style={{
								fontSize: 10,
								fontWeight: 600,
								letterSpacing: '.16em',
								color: MUTED
							}}
						>
							{p.label.toUpperCase()}
						</div>
					</div>
				))}
			</div>
		);
	}

	const gap = Math.round(size * 1.1);
	const groups = parts.map((p, i) => renderGroup(`g${i}`, p));

	if (layout === 'quad') {
		return (
			<div
				role="timer"
				aria-label={ariaLabel}
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap,
					alignItems: 'center'
				}}
			>
				<div style={{ display: 'flex', gap }}>
					{groups[0]}
					{groups[1]}
				</div>
				<div style={{ display: 'flex', gap }}>
					{groups[2] ?? null}
					{groups[3] ?? null}
				</div>
			</div>
		);
	}

	return (
		<div
			role="timer"
			aria-label={ariaLabel}
			style={{
				display: 'flex',
				alignItems: 'flex-start',
				gap: Math.round(size * 1.3),
				justifyContent: 'center'
			}}
		>
			{plus && (
				<div
					style={{
						fontSize: size * 2.4,
						fontWeight: 300,
						color: HAND_COLOR,
						lineHeight: 1,
						paddingBottom: size * 0.9
					}}
				>
					+
				</div>
			)}
			{groups}
		</div>
	);
};
