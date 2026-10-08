import {
	CarimatRobotIcon,
	useAssistantIdentity
} from '../carimat/AssistantIdentity';
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
	const { name } = useAssistantIdentity();

	const message = t('anonymousChat.pseudonym.carimatMessage');

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
							{name}
						</span>
						<span className="pseudonymCard__headerSubtitle">
							{t('anonymousChat.pseudonym.carimatSubtitle')}
						</span>
					</div>

					<TypingReveal typingMs={skipTyping ? 0 : 700}>
						<div className="pseudonymCard__bubble">
							<p className="pseudonymCard__bubbleText">
								{skipTyping ? (
									message
								) : (
									<TypewriterText
										text={message}
										startDelayMs={220}
										onDone={handleTypewriterDone}
									/>
								)}
							</p>

							{pseudonymRevealed && (
								<div className="pseudonymCard__displayColumn pseudonymCard__displayColumn--revealed">
									<div className="pseudonymCard__label">
										{t(
											'anonymousChat.pseudonym.yourPseudonym'
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
