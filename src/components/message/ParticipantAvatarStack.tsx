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
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chosenAvatarOf } from '../../utils/avatarChoice';
import { MessageAvatar } from './MessageAvatar';
import {
	resolveParticipantStack,
	STACK_MAX_VISIBLE,
	STACK_AVATAR_SIZE,
	STACK_OVERLAP,
	HEADER_STACK_AVATAR_SIZE,
	HEADER_STACK_OVERLAP,
	type StackParticipant
} from './participantStack';
import './participantAvatarStack.styles.scss';

export interface ParticipantAvatarStackProps {
	'participants': StackParticipant[];
	/** Avatar diameter. Existing card consumers retain their explicit size. */
	'size'?: number;
	/** Overlap between avatars; header and card geometry are independent. */
	'overlap'?: number;
	'maxVisible'?: number;
	'className'?: string;
	'data-cy'?: string;
}

/** Legacy 40px geometry remains the default; headers opt into HEADER_STACK_PROPS. */
export { STACK_AVATAR_SIZE, STACK_OVERLAP } from './participantStack';
export const STACK_PILL_OVERLAP = 8;
export const STACK_TITLE_INSET = 6;
/** Legacy/default step (40 − 12); current headers opt into HEADER_STACK_PROPS. */
export const STACK_STEP = STACK_AVATAR_SIZE - STACK_OVERLAP;
export const stackStepFor = (size: number, overlap = STACK_OVERLAP) =>
	Math.max(0, size - overlap);

/** Current header geometry; never apply this preset to list cards. */
export const HEADER_STACK_PROPS = {
	size: HEADER_STACK_AVATAR_SIZE,
	overlap: HEADER_STACK_OVERLAP
} as const;

export const ParticipantAvatarStack = ({
	participants,
	size = STACK_AVATAR_SIZE,
	overlap = STACK_OVERLAP,
	maxVisible = STACK_MAX_VISIBLE,
	className,
	'data-cy': dataCy = 'participant-stack'
}: ParticipantAvatarStackProps) => {
	const { t: translate } = useTranslation();
	const tipIdBase = useId();
	// Track hover and focus independently; Escape dismisses either without moving focus.
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const activeIndex = hoveredIndex ?? focusedIndex;
	const openIndex = dismissed ? null : activeIndex;
	useEffect(() => {
		if (openIndex === null) return;
		const dismiss = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setDismissed(true);
		};
		document.addEventListener('keydown', dismiss);
		return () => document.removeEventListener('keydown', dismiss);
	}, [openIndex]);
	const { visible, overflow } = resolveParticipantStack(
		participants,
		maxVisible
	);

	if (visible.length === 0 && overflow === 0) {
		return null;
	}

	const names = participants.map((p) => p.displayName).filter(Boolean);
	const overflowLabel = translate('chatStage.participants.more', {
		count: overflow,
		defaultValue: '{{count}} weitere Teilnehmende'
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
					'--participant-step': `${stackStepFor(size, overlap)}px`
				} as React.CSSProperties
			}
			aria-label={translate('chatStage.participants.label', {
				names: names.join(', '),
				defaultValue: 'Teilnehmende: {{names}}'
			})}
			data-cy={dataCy}
		>
			{visible.map((participant, index) => {
				const tipId = `${tipIdBase}-${index}`;
				return (
					<li
						key={participant.userId}
						className="participantStack__item"
						style={{
							zIndex:
								activeIndex === index
									? visible.length + 1
									: visible.length - index
						}}
						data-open={openIndex === index ? 'true' : 'false'}
						onMouseEnter={() => {
							setHoveredIndex(index);
							setDismissed(false);
						}}
						onMouseLeave={() =>
							setHoveredIndex((current) =>
								current === index ? null : current
							)
						}
						onFocus={() => {
							setFocusedIndex(index);
							setDismissed(false);
						}}
						onBlur={() =>
							setFocusedIndex((current) =>
								current === index ? null : current
							)
						}
					>
						<span
							className="participantStack__avatar"
							tabIndex={0}
							aria-label={participant.displayName}
							aria-describedby={
								openIndex === index ? tipId : undefined
							}
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
								choice={chosenAvatarOf(participant)}
								size={size}
							/>
						</span>
						<span
							role="tooltip"
							aria-hidden={openIndex !== index}
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
