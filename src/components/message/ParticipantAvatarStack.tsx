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
	/** Avatar diameter; the visible step between avatars is always 22 px. */
	'size'?: number;
	'maxVisible'?: number;
	'className'?: string;
	'data-cy'?: string;
}

/** Frank (05.09.): 22 px visible per avatar in the stack (32 px avatars). */
export const STACK_STEP = 22;

export const ParticipantAvatarStack = ({
	participants,
	size = 32,
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
					'--participant-step': `${STACK_STEP}px`
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
