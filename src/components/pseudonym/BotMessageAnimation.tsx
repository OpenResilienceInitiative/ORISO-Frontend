import React, { useEffect, useRef, useState } from 'react';

/**
 * Three-dot "typing…" indicator with staggered bounce animation.
 * Uses inline styles so it works without touching global styles.
 */
export const TypingDots: React.FC<{ className?: string }> = ({ className }) => (
	<span
		className={className}
		aria-label="typing"
		style={{
			display: 'inline-flex',
			alignItems: 'center',
			gap: 6,
			height: 22
		}}
	>
		{[0, 1, 2].map((i) => (
			<span
				key={i}
				style={{
					width: 8,
					height: 8,
					borderRadius: '50%',
					background: '#8a8f96',
					animation: `botMessageTypingBounce 1.1s ${i * 0.18}s infinite ease-in-out`,
					display: 'inline-block'
				}}
			/>
		))}
	</span>
);

/**
 * Reveals `text` character-by-character with a terminal-style jitter:
 * each character waits 70 + (random 0-100) ms, and the trailing cursor
 * is a "_" that toggles with the current index (visible on odd, empty
 * on even) — same idiom as the reference Typewriter.js. `charMs`/
 * `startDelayMs` are kept in the prop signature for backwards compat
 * but charMs is superseded by the jittered delay.
 */
export const TypewriterText: React.FC<{
	text: string;
	charMs?: number;
	startDelayMs?: number;
	onDone?: () => void;
	className?: string;
}> = ({ text, startDelayMs = 0, onDone, className }) => {
	const [visibleLen, setVisibleLen] = useState(0);
	const doneRef = useRef(false);
	/* Stash onDone in a ref so a fresh function reference from the
	   consumer does not re-trigger the effect and restart typing from
	   zero. The effect should only restart when text or startDelayMs
	   actually change. */
	const onDoneRef = useRef<(() => void) | undefined>(onDone);
	useEffect(() => {
		onDoneRef.current = onDone;
	}, [onDone]);

	useEffect(() => {
		setVisibleLen(0);
		doneRef.current = false;
		let cancelled = false;
		let timer: number | undefined;

		const start = window.setTimeout(() => {
			if (cancelled) return;
			const tick = () => {
				if (cancelled) return;
				setVisibleLen((prev) => {
					if (prev >= text.length) return prev;
					const next = prev + 1;
					if (next >= text.length && !doneRef.current) {
						doneRef.current = true;
						const cb = onDoneRef.current;
						if (cb) window.setTimeout(cb, 0);
					}
					return next;
				});
				timer = window.setTimeout(tick, 45 + 55 * Math.random());
			};
			tick();
		}, startDelayMs);

		return () => {
			cancelled = true;
			if (timer) window.clearTimeout(timer);
			window.clearTimeout(start);
		};
	}, [text, startDelayMs]);

	const done = visibleLen >= text.length;
	const cursor = visibleLen & 1 ? '_' : ' ';
	return (
		<span className={className}>
			{text.slice(0, visibleLen)}
			{!done && cursor}
		</span>
	);
};

/**
 * Global keyframes injected once so the typing/caret animations work
 * without requiring a stylesheet change per consumer.
 */
let keyframesInjected = false;
const ensureBotAnimationKeyframes = () => {
	if (keyframesInjected) return;
	if (typeof document === 'undefined' || !document.head) return;
	keyframesInjected = true;
	try {
		const style = document.createElement('style');
		style.setAttribute('data-bot-message-keyframes', 'true');
		style.textContent = `
@keyframes botMessageTypingBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
@keyframes botMessageCaretBlink {
  50% { opacity: 0; }
}
@keyframes botMessageFadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
		document.head.appendChild(style);
	} catch {
		keyframesInjected = false;
	}
};

/**
 * Shows a typing-dots bubble for `typingMs` ms, then reveals `children`
 * with a subtle fade-up. Use for any Carimat bubble we want to "feel" bot-like.
 */
export const TypingReveal: React.FC<{
	typingMs?: number;
	children: React.ReactNode;
	onReveal?: () => void;
	bubbleClassName?: string;
}> = ({ typingMs = 1200, children, onReveal, bubbleClassName }) => {
	useEffect(() => {
		ensureBotAnimationKeyframes();
	}, []);
	const [revealed, setRevealed] = useState(typingMs <= 0);

	useEffect(() => {
		if (typingMs <= 0) {
			if (onReveal) onReveal();
			return;
		}
		const t = window.setTimeout(() => {
			setRevealed(true);
			if (onReveal) onReveal();
		}, typingMs);
		return () => window.clearTimeout(t);
	}, [typingMs, onReveal]);

	if (!revealed) {
		return (
			<div
				className={bubbleClassName}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					padding: '18px 22px',
					borderRadius: '4px 14px 14px 14px',
					background: '#eeeeee',
					minHeight: 52
				}}
			>
				<TypingDots />
			</div>
		);
	}

	return (
		<div
			style={{
				animation: 'botMessageFadeUp 260ms ease-out both'
			}}
		>
			{children}
		</div>
	);
};
