import * as React from 'react';

import styles from './namePill.module.scss';

export interface NamePillProps {
	/** What this person is called. Never omitted — see below. */
	name: string;
	/** Milliseconds since the hand went up, or null/undefined if it is down. */
	handRaisedForMs?: number | null;
	micOff?: boolean;
	speaking?: boolean;
	/**
	 * How wide the capsule may get, in px.
	 *
	 * The handoff's 132px counts the glyphs, so a raised hand with its
	 * duration leaves the name about forty pixels — "naher O…" instead of
	 * "naher Otter 303", which removes the very part that identifies someone.
	 *
	 * Wider is better, but not without a ceiling: a capsule broader than the
	 * shape it sits on hangs over the neighbours, and these arrangements abut
	 * by design. So the arrangement, which knows the shape, sets this; the
	 * ellipsis stays as the guard behind it.
	 */
	maxWidth?: number;
	className?: string;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * How long a hand has been up, as "m:ss" or "h:mm:ss".
 *
 * The number is the point. A bare hand icon says somebody wants to speak; the
 * duration is what makes a facilitator act, because a hand up for eight
 * minutes is a different situation from one up for eight seconds. Negative and
 * sub-second values read as 0:00 rather than blank or NaN.
 */
export function formatHandDuration(elapsedMs: number): string {
	const total = Math.max(0, Math.floor(elapsedMs / SECOND));
	const seconds = total % 60;
	const minutes = Math.floor(total / 60) % 60;
	const hours = Math.floor(elapsedMs / HOUR);
	const pad = (n: number) => String(n).padStart(2, '0');
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}

const HandIcon = () => (
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<path
			fill="currentColor"
			d="M7.1 1.6a.9.9 0 0 1 1.8 0v5.1h.5V2.5a.9.9 0 0 1 1.8 0v4.2h.5V4a.9.9 0 0 1 1.8 0v5.6c0 3-1.9 4.8-4.6 4.8-1.6 0-2.8-.6-3.8-2L2.4 9.1a.9.9 0 0 1 1.4-1.1l1.5 1.7V3a.9.9 0 0 1 1.8 0v4.7h.5z"
		/>
	</svg>
);

const MicOffIcon = () => (
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<path
			fill="currentColor"
			d="M11 6.6V4a3 3 0 0 0-5.7-1.3zM3.3 2.2 2.2 3.3l2.8 2.8V8a3 3 0 0 0 4.3 2.7l1 1A5 5 0 0 1 3 8H1.7a6.3 6.3 0 0 0 5.6 6.2v1.5h1.4v-1.5c1-.1 2-.4 2.8-1l1.2 1.3 1.1-1.1zM14.3 8H13c0 .6-.1 1.2-.3 1.7l1 1c.4-.8.6-1.7.6-2.7"
		/>
	</svg>
);

/**
 * The one way a person is labelled on a call stage.
 *
 * The handoff is unusually firm about this: "the single answer to how do we
 * label a person. There is exactly one spec, used on every screen and in
 * every state." Placement differs per arrangement and is the arrangement's
 * business; the capsule is not.
 *
 * Status glyphs sit INSIDE the capsule rather than beside it. That is the
 * rule most likely to erode — somebody adds one more indicator and floats it
 * next to the name — so the test asserts containment, not just presence.
 */
export const NamePill: React.FC<NamePillProps> = ({
	name,
	handRaisedForMs,
	micOff = false,
	speaking = false,
	maxWidth,
	className
}) => {
	const handUp = handRaisedForMs !== null && handRaisedForMs !== undefined;

	return (
		<span
			data-testid="name-pill"
			data-speaking={speaking}
			className={[styles.namePill, className].filter(Boolean).join(' ')}
			style={
				maxWidth === undefined
					? undefined
					: ({
							'--name-pill-max': `${maxWidth}px`
						} as React.CSSProperties)
			}
		>
			{handUp && (
				<span
					data-testid="glyph-hand"
					className={`${styles.glyph} ${styles.hand}`}
				>
					<HandIcon />
					<span className={styles.duration}>
						{formatHandDuration(handRaisedForMs)}
					</span>
					<span className={styles.srOnly}>
						Hand gehoben seit {formatHandDuration(handRaisedForMs)}
					</span>
				</span>
			)}
			{micOff && (
				<span data-testid="glyph-mic-off" className={styles.glyph}>
					<MicOffIcon />
					<span className={styles.srOnly}>Mikrofon aus</span>
				</span>
			)}
			<span data-testid="name-pill-text" className={styles.name}>
				{name}
			</span>
		</span>
	);
};
