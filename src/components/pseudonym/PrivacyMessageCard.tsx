import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TypewriterText, TypingReveal } from './BotMessageAnimation';
import './PseudonymCard.styles.scss';
import './PrivacyMessageCard.styles.scss';

/** Carimat robot_2 icon — exact path from Figma node 1320:38837. */
const CarimatRobotIcon: React.FC = () => (
	<svg
		width="32"
		height="36"
		viewBox="0 0 32 36"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M0 36V26C0 24.9 0.391667 23.9583 1.175 23.175C1.95833 22.3917 2.9 22 4 22H28C29.1 22 30.0417 22.3917 30.825 23.175C31.6083 23.9583 32 24.9 32 26V36H0ZM10 20C7.23333 20 4.875 19.025 2.925 17.075C0.975 15.125 0 12.7667 0 10C0 7.23333 0.975 4.875 2.925 2.925C4.875 0.975 7.23333 0 10 0H22C24.7667 0 27.125 0.975 29.075 2.925C31.025 4.875 32 7.23333 32 10C32 12.7667 31.025 15.125 29.075 17.075C27.125 19.025 24.7667 20 22 20H10ZM4 32H28V26H4V32ZM10 16H22C23.6667 16 25.0833 15.4167 26.25 14.25C27.4167 13.0833 28 11.6667 28 10C28 8.33333 27.4167 6.91667 26.25 5.75C25.0833 4.58333 23.6667 4 22 4H10C8.33333 4 6.91667 4.58333 5.75 5.75C4.58333 6.91667 4 8.33333 4 10C4 11.6667 4.58333 13.0833 5.75 14.25C6.91667 15.4167 8.33333 16 10 16ZM11.425 11.425C11.8083 11.0417 12 10.5667 12 10C12 9.43333 11.8083 8.95833 11.425 8.575C11.0417 8.19167 10.5667 8 10 8C9.43333 8 8.95833 8.19167 8.575 8.575C8.19167 8.95833 8 9.43333 8 10C8 10.5667 8.19167 11.0417 8.575 11.425C8.95833 11.8083 9.43333 12 10 12C10.5667 12 11.0417 11.8083 11.425 11.425ZM23.425 11.425C23.8083 11.0417 24 10.5667 24 10C24 9.43333 23.8083 8.95833 23.425 8.575C23.0417 8.19167 22.5667 8 22 8C21.4333 8 20.9583 8.19167 20.575 8.575C20.1917 8.95833 20 9.43333 20 10C20 10.5667 20.1917 11.0417 20.575 11.425C20.9583 11.8083 21.4333 12 22 12C22.5667 12 23.0417 11.8083 23.425 11.425Z"
			fill="currentColor"
		/>
	</svg>
);

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

	const message = t(
		'anonymousChat.pseudonym.privacyMessage',
		'Great choice, to protect your privacy all messages are end to end encrypted and will be deleted after 48h automatically.'
	);

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
							Carimat
						</span>
						<span className="pseudonymCard__headerSubtitle">
							{t(
								'anonymousChat.pseudonym.carimatPrivacySubtitle',
								'Your privacy'
							)}
						</span>
					</div>

					{/* Pre-typing pause feels more "human" — the typing dots
					    linger a little and the first character only appears
					    after a deliberate beat (see `startDelayMs` below). */}
					<TypingReveal typingMs={skipTyping ? 0 : 1400}>
						<div className="pseudonymCard__bubble privacyMessageCard__bubble">
							<p className="pseudonymCard__bubbleText privacyMessageCard__bubbleText">
								{skipTyping ? (
									message
								) : (
									<TypewriterText
										text={message}
										startDelayMs={550}
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
