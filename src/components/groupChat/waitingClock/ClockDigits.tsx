import * as React from 'react';
import { digitCells, twoDigits } from './waitingClockDigits';

const HAND_COLOR = '#CC1E1C';

export interface ClockDigitsProps {
	/** 0–99, rendered as two "clock made of clocks" digits. */
	value: number;
	/** Diameter of one mini-clock in px. */
	size?: number;
	/** Static, motion-free fallback: big tabular Inter digits. */
	reducedMotion?: boolean;
	/** These digits are decorative (a label/aria elsewhere describes the value). */
	ariaHidden?: boolean;
}

/**
 * Two "clock made of clocks" digits for one value (e.g. hours), no label/chrome.
 *
 * Hand angles accumulate forward-only across renders (a clock never rewinds) via
 * a ref, and the grid assembles from random start angles for ~0.9s on mount.
 * This is the shared primitive behind both the standalone clock and the
 * flip-behind-numbers waiting screen.
 */
export const ClockDigits = ({
	value,
	size = 30,
	reducedMotion = false,
	ariaHidden = true
}: ClockDigitsProps) => {
	const prev = React.useRef<Record<string, number>>({});
	const rand = React.useRef<Record<string, [number, number]>>({});
	const [initial, setInitial] = React.useState(!reducedMotion);

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
					color: '#1A1A1A',
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
	const transition = initial
		? 'transform 1s ease-in-out'
		: 'transform .5s ease-in-out';

	const renderCell = (key: string, h: number, m: number) => {
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

	const gap = Math.max(2, Math.round(size * 0.1));
	const renderDigit = (key: string, d: number) => (
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

	return (
		<div
			aria-hidden={ariaHidden}
			style={{ display: 'flex', gap: Math.round(size * 0.35) }}
		>
			{twoDigits(value).map((d, i) => renderDigit(`d${i}`, d))}
		</div>
	);
};
