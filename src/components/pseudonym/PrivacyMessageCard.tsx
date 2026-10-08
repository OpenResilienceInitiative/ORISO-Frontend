import {
	CarimatRobotIcon,
	useAssistantIdentity
} from '../carimat/AssistantIdentity';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TypewriterText, TypingReveal } from './BotMessageAnimation';
import './PseudonymCard.styles.scss';
import './PrivacyMessageCard.styles.scss';
export { CarimatRobotIcon } from '../carimat/AssistantIdentity';

/** Carimat robot_2 icon — exact path from Figma node 1320:38837.
 *  Exported for reuse as the bot avatar on chat system notifications. */

interface PrivacyMessageCardProps {
	/** Skip the typing-dots phase and reveal immediately (e.g. on re-render). */
	skipTyping?: boolean;
	/** Fired after the typewriter finishes writing the text. */
	onDone?: () => void;
}

/**
 * Second Carimat bot message — privacy/encryption notice shown AFTER the
 * pseudonym is confirmed. Matches Figma "Group10":
 *
 *   ┌───┐  Carimat · Select displayed name
 *   │ 🤖│  ┌──────────────────────────┐
 *   └───┘  │ Great choice, to protect │
 *    ⋮     │ your privacy all …       │
 *          └──────────────────────────┘
 */
export const PrivacyMessageCard: React.FC<PrivacyMessageCardProps> = ({
	skipTyping = false,
	onDone
}) => {
	const { t } = useTranslation();
	const { name } = useAssistantIdentity();
	/* Keep the card's trailing edge visible at all times while the
	   typewriter is running. A ResizeObserver on the root element fires
	   every time the bubble grows a line (newlines / wraps during typing)
	   and calls scrollIntoView({ block: 'end' }) so the new content never
	   hides under the floating waiting-queue action bar. */
	const rootRef = useRef<HTMLDivElement | null>(null);
	const scrollIntoViewSafely = () => {
		const node = rootRef.current;
		if (!node) return;
		try {
			node.scrollIntoView({ behavior: 'smooth', block: 'end' });
		} catch {
			node.scrollIntoView();
		}
	};
	useEffect(() => {
		if (skipTyping) return;
		const mountId = window.setTimeout(scrollIntoViewSafely, 60);
		const node = rootRef.current;
		if (!node || typeof ResizeObserver === 'undefined') {
			return () => window.clearTimeout(mountId);
		}
		const observer = new ResizeObserver(() => scrollIntoViewSafely());
		observer.observe(node);
		return () => {
			window.clearTimeout(mountId);
			observer.disconnect();
		};
	}, [skipTyping]);
	const handleTypingDone = () => {
		// One final nudge after the typewriter finishes.
		window.setTimeout(scrollIntoViewSafely, 60);
		if (onDone) onDone();
	};

	const message = t('anonymousChat.pseudonym.privacyMessage');

	return (
		<div
			ref={rootRef}
			className="messageItem pseudonymCard privacyMessageCard"
		>
			<div className="messageItem__messageWrap pseudonymCard__wrap">
				<div className="pseudonymCard__avatarCol">
					<div className="pseudonymCard__avatarFrame">
						<div className="pseudonymCard__avatarIcon">
							<CarimatRobotIcon />
						</div>
					</div>
				</div>

				<div className="pseudonymCard__contentCol">
					<div className="pseudonymCard__header">
						<span className="pseudonymCard__headerName">
							{name}
						</span>
						<span className="pseudonymCard__headerSubtitle">
							{t(
								'anonymousChat.pseudonym.carimatPrivacySubtitle'
							)}
						</span>
					</div>

					{/* Pre-typing pause feels more "human" — the typing dots
					    linger a little and the first character only appears
					    after a deliberate beat (see `startDelayMs` below). */}
					<TypingReveal typingMs={skipTyping ? 0 : 700}>
						<div className="pseudonymCard__bubble privacyMessageCard__bubble">
							<p className="pseudonymCard__bubbleText privacyMessageCard__bubbleText">
								{skipTyping ? (
									message
								) : (
									<TypewriterText
										text={message}
										startDelayMs={220}
										onDone={handleTypingDone}
									/>
								)}
							</p>
						</div>
					</TypingReveal>
				</div>
			</div>
		</div>
	);
};
