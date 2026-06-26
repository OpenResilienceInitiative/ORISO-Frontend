import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Pseudonym } from '../../utils/pseudonymGenerator';
import { AnimalAvatar } from './AnimalAvatar';
import { TypewriterText, TypingReveal } from './BotMessageAnimation';
import './PseudonymCard.styles.scss';

interface PseudonymCardProps {
	pseudonym: Pseudonym;
	/** Skip the typing-dots phase and reveal immediately. */
	skipTyping?: boolean;
	/** Fires once the typewriter has finished writing the message. */
	onDone?: () => void;
}

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

/**
 * Carimat pseudonym chat message — reads as a left-aligned chat message:
 *
 *   ┌───┐  Carimat · Select displayed name
 *   │ 🤖│  ┌──────────────────────────┐
 *   └───┘  │ Hallo, bevor wir …       │
 *    ⋮     │                          │
 *          │ DEIN PSEUDONYM           │
 *          │      (pink cat 108px)    │
 *          │ geschmeidiges Kaninchen  │
 *          └──────────────────────────┘
 *
 * The bubble flat-corner sits on the top-left so it visually attaches to
 * the avatar column, just like the other robot onboarding messages.
 */
export const PseudonymCard: React.FC<PseudonymCardProps> = ({
	pseudonym,
	skipTyping = false,
	onDone
}) => {
	const { t } = useTranslation();

	const message = t(
		'anonymousChat.pseudonym.carimatMessage',
		'Hi there before we move on please confirm for this session our randomly chosen username.'
	);

	/* Reveal the pseudonym display column (label + avatar + name) only
	   after the typewriter finishes. Fires once either because skipTyping
	   is true (no typewriter runs) or because TypewriterText.onDone
	   notified us. The bubble naturally expands because the reveal block
	   slide-animates its max-height / opacity in CSS. */
	const [pseudonymRevealed, setPseudonymRevealed] = useState(skipTyping);
	const handleTypewriterDone = useCallback(() => {
		setPseudonymRevealed(true);
		if (onDone) onDone();
	}, [onDone]);

	return (
		<div className="messageItem pseudonymCard">
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
								'anonymousChat.pseudonym.carimatSubtitle',
								'Select displayed name'
							)}
						</span>
					</div>

					<TypingReveal typingMs={skipTyping ? 0 : 1400}>
						<div className="pseudonymCard__bubble">
							<p className="pseudonymCard__bubbleText">
								{skipTyping ? (
									message
								) : (
									<TypewriterText
										text={message}
										startDelayMs={550}
										onDone={handleTypewriterDone}
									/>
								)}
							</p>

							{pseudonymRevealed && (
								<div className="pseudonymCard__displayColumn pseudonymCard__displayColumn--revealed">
									<div className="pseudonymCard__label">
										{t(
											'anonymousChat.pseudonym.yourPseudonym',
											'Dein Pseudonym'
										)}
									</div>

									<AnimalAvatar
										avatar={pseudonym.avatar}
										size={108}
									/>

									<div className="pseudonymCard__name">
										{pseudonym.displayName}
									</div>
								</div>
							)}
						</div>
					</TypingReveal>
				</div>
			</div>
		</div>
	);
};
