/**
 * Participant avatar stack — the Figma "Avatar Group" of the room header
 * (1320:38281 → Room Header All), shared by the session header and the
 * side-panel header so both stack the same `MessageAvatar` atom the chat
 * bubbles use (animal for the advice seeker, monogram / photo for
 * counsellors).
 *
 * Every avatar is focusable and carries its display name as a tooltip
 * (hover and keyboard focus); the tail beyond four folds into "+N"
 * (ORISO-Frontend#1193). Order and overflow come from `participantStack.ts`.
 */
import * as React from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageAvatar } from './MessageAvatar';
import {
	resolveParticipantStack,
	STACK_MAX_VISIBLE,
	type StackParticipant
} from './participantStack';
import './participantAvatarStack.styles.scss';

export interface ParticipantAvatarStackProps {
	'participants': StackParticipant[];
	/**
	 * Avatar diameter (Figma room header: 40). The visible step is always
	 * `size − STACK_OVERLAP`, so the 32 px library variant steps 20 px.
	 */
	'size'?: number;
	'maxVisible'?: number;
	'className'?: string;
	'data-cy'?: string;
}

/**
 * Measured in Figma (T14/T17, `get_metadata` on 1320:38281 → Room Header
 * All → Avatar Group): avatars 40 × 40 at x = 0/28/56/84/112 → 12 px overlap;
 * the library master (7608:40689) draws 32 px avatars at 0/20/40/… — the
 * same 12 px overlap. The group starts 8 px inside the type pill
 * (`x = 65.5` in a 73.5 px pill) and the title text follows 6 px after it.
 */
export const STACK_AVATAR_SIZE = 40;
export const STACK_OVERLAP = 12;
export const STACK_PILL_OVERLAP = 8;
export const STACK_TITLE_INSET = 6;
/** Visible step per avatar for the room header (40 − 12). */
export const STACK_STEP = STACK_AVATAR_SIZE - STACK_OVERLAP;
export const stackStepFor = (size: number) => Math.max(0, size - STACK_OVERLAP);

export const ParticipantAvatarStack = ({
	participants,
	size = STACK_AVATAR_SIZE,
	maxVisible = STACK_MAX_VISIBLE,
	className,
	'data-cy': dataCy = 'participant-stack'
}: ParticipantAvatarStackProps) => {
	const { t: translate } = useTranslation();
	const tipIdBase = useId();
	// Hover/focus state mirrored into the DOM so the tooltip works with
	// synthetic pointer events (tests, assistive tech) as well as CSS :hover.
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const { visible, overflow } = resolveParticipantStack(
		participants,
		maxVisible
	);

	if (visible.length === 0) {
		return null;
	}

	const names = participants.map((p) => p.displayName).filter(Boolean);
	const overflowLabel = translate('chatStage.participants.more', {
		count: overflow
	});

	return (
		<ul
			className={[
				'participantStack',
				overflow > 0 && 'participantStack--overflow',
				className
			]
				.filter(Boolean)
				.join(' ')}
			style={
				{
					'--participant-size': `${size}px`,
					'--participant-step': `${stackStepFor(size)}px`
				} as React.CSSProperties
			}
			aria-label={translate('chatStage.participants.label', {
				names: names.join(', ')
			})}
			data-cy={dataCy}
		>
			{visible.map((participant, index) => {
				const tipId = `${tipIdBase}-${index}`;
				return (
					<li
						key={participant.userId}
						className="participantStack__item"
						style={{ zIndex: visible.length - index }}
						data-open={openIndex === index ? 'true' : 'false'}
						onMouseEnter={() => setOpenIndex(index)}
						onMouseLeave={() =>
							setOpenIndex((current) =>
								current === index ? null : current
							)
						}
						onFocus={() => setOpenIndex(index)}
						onBlur={() =>
							setOpenIndex((current) =>
								current === index ? null : current
							)
						}
					>
						<span
							className="participantStack__avatar"
							tabIndex={0}
							aria-label={participant.displayName}
							aria-describedby={tipId}
							data-cy="participant-avatar"
							data-user-id={participant.userId}
						>
							<MessageAvatar
								isGroup={!participant.isAsker}
								isSystemNotification={false}
								userId={participant.userId}
								username={
									participant.username ??
									participant.displayName
								}
								displayName={participant.displayName}
								firstName={participant.firstName}
								lastName={participant.lastName}
								size={size}
							/>
						</span>
						<span
							role="tooltip"
							id={tipId}
							className="participantStack__tip"
							data-cy="participant-tooltip"
						>
							{participant.displayName}
						</span>
					</li>
				);
			})}
			{overflow > 0 && (
				<li
					className="participantStack__item participantStack__item--overflow"
					style={{ zIndex: 0 }}
				>
					<span
						className="participantStack__overflow"
						title={overflowLabel}
						aria-label={overflowLabel}
						data-cy="participant-overflow"
					>
						+{overflow}
					</span>
				</li>
			)}
		</ul>
	);
};

export default ParticipantAvatarStack;
