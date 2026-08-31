import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CarimatRobotIcon } from '../pseudonym/PrivacyMessageCard';
import { TypingDots } from '../pseudonym/BotMessageAnimation';
import { ErstantwortActionKind } from './erstantwortPayload';
import { ResolvedBaustein } from './erstantwortResolve';
import '../pseudonym/PseudonymCard.styles.scss';
import './ErstantwortSequence.styles.scss';

/**
 * ADR-018: renders the Erstantwort as a **staged** sequence of Carimat bubbles.
 *
 * Staged, not all at once, for a reason that is not decoration: this is a
 * ~10-bubble message that lands on someone who has just written about something
 * hard. Dropping ten paragraphs into the room in one frame reads as a wall of
 * terms and conditions. Revealing them at a human pace, each preceded by typing
 * dots, reads as somebody answering.
 *
 * Carimat is a **rendering identity, not a Matrix account** (ADR-018 §3) — the
 * name and avatar are drawn here, client-side. Nothing in this component joins
 * a room or holds a key.
 *
 * Deliberately **not** a dialog: the old consent gate carries
 * `role="dialog" aria-modal="true"` although it renders inline in the message
 * stream, which tells a screen reader something untrue. This is an inline
 * `aria-live="polite"` region — announced as it arrives, never trapping focus,
 * never blocking the composer.
 */

export interface ErstantwortSequenceProps {
	bausteine: ResolvedBaustein[];
	/** Delay between two bubbles. Also the typing-dots duration. */
	staggerMs?: number;
	/** Render everything at once — Storybook, tests, and re-renders of history. */
	skipAnimation?: boolean;
	/** Fired once, when the first bubble has revealed. */
	onFirstReveal?: () => void;
	/** Fired when an action Baustein's button is pressed. */
	onAction?: (kind: ErstantwortActionKind) => void;
	/** Subtitle beside the Carimat name; defaults to the platform wording. */
	subtitle?: string;
	/**
	 * Extra content rendered inside a specific Baustein's bubble, keyed by id.
	 * Used by the post-dispatch slice, where "Zugangsdaten sichern" is a card
	 * rather than a button — the person needs the login name in front of them,
	 * not a dialog they have to open first.
	 */
	slots?: Record<string, React.ReactNode>;
}

const DEFAULT_STAGGER_MS = 1400;

/**
 * No handler, no button. An enabled control that does nothing is worse than an
 * absent one anywhere, and worst of all in the message that is meant to be the
 * transparency record — the person presses it, nothing happens, and they are
 * left unsure whether they just did something.
 */
const renderAction = (
	action: NonNullable<ResolvedBaustein['action']>,
	onAction?: (kind: ErstantwortActionKind) => void
) =>
	onAction ? (
		<button
			type="button"
			className="erstantwort__action"
			onClick={() => onAction(action.kind)}
		>
			{action.label}
		</button>
	) : null;

export const ErstantwortSequence: React.FC<ErstantwortSequenceProps> = ({
	bausteine,
	staggerMs = DEFAULT_STAGGER_MS,
	skipAnimation = false,
	onFirstReveal,
	onAction,
	subtitle,
	slots
}) => {
	const { t } = useTranslation();
	const total = bausteine.length;

	/* How many bubbles have revealed so far. With the animation skipped every
	   bubble is present from the first render, which is what history re-renders
	   and Storybook need — nobody wants to sit through the stagger twice. */
	const [revealed, setRevealed] = useState(skipAnimation ? total : 0);

	/* Stashed in a ref so a fresh callback identity from the caller does not
	   restart the sequence from bubble zero — the same trap TypewriterText
	   documents in BotMessageAnimation.tsx. */
	const onFirstRevealRef = useRef(onFirstReveal);
	useEffect(() => {
		onFirstRevealRef.current = onFirstReveal;
	}, [onFirstReveal]);
	const firstRevealFired = useRef(false);

	useEffect(() => {
		if (skipAnimation) {
			setRevealed(total);
			return;
		}
		setRevealed(0);
		firstRevealFired.current = false;
		if (!total) return;

		const timers: number[] = [];
		for (let index = 0; index < total; index += 1) {
			timers.push(
				window.setTimeout(
					() =>
						setRevealed((current) => Math.max(current, index + 1)),
					staggerMs * (index + 1)
				)
			);
		}
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [total, staggerMs, skipAnimation]);

	useEffect(() => {
		if (revealed < 1 || firstRevealFired.current) return;
		firstRevealFired.current = true;
		const callback = onFirstRevealRef.current;
		if (callback) callback();
	}, [revealed]);

	const visible = useMemo(
		() => bausteine.slice(0, revealed),
		[bausteine, revealed]
	);
	/* Typing dots stand in for the bubble that is still coming, so a short
	   Baustein is not immediately followed by the next one out of nowhere. */
	const isTyping = revealed < total;

	if (!total) return null;

	return (
		<div
			className="erstantwort"
			aria-live="polite"
			data-testid="erstantwort-sequence"
		>
			<div className="messageItem pseudonymCard erstantwort__row">
				<div className="messageItem__messageWrap pseudonymCard__wrap">
					<div className="pseudonymCard__avatarCol">
						<div className="pseudonymCard__avatarFrame">
							<div className="pseudonymCard__avatarIcon">
								<CarimatRobotIcon />
							</div>
						</div>
					</div>

					<div className="pseudonymCard__contentCol erstantwort__content">
						<div className="pseudonymCard__header">
							<span className="pseudonymCard__headerName">
								Carimat
							</span>
							<span className="pseudonymCard__headerSubtitle">
								{subtitle ?? t('erstantwort.subtitle')}
							</span>
						</div>

						{visible.map((baustein) => (
							<div
								key={baustein.id}
								className="pseudonymCard__bubble erstantwort__bubble"
							>
								{baustein.headline && (
									<h4 className="erstantwort__headline">
										{baustein.headline}
									</h4>
								)}
								<p className="pseudonymCard__bubbleText erstantwort__body">
									{baustein.body}
								</p>
								{baustein.links?.length ? (
									<ul className="erstantwort__links">
										{baustein.links.map((link) => (
											<li key={link.url}>
												<a
													href={link.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{link.label}
												</a>
											</li>
										))}
									</ul>
								) : null}
								{slots?.[baustein.id]}
								{baustein.action &&
									renderAction(baustein.action, onAction)}
							</div>
						))}

						{isTyping && (
							<div className="pseudonymCard__bubble erstantwort__bubble erstantwort__bubble--typing">
								<TypingDots />
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
