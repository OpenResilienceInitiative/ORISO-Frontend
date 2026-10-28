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
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { chosenAvatarOf } from '../../utils/avatarChoice';
import { MessageAvatar } from './MessageAvatar';
import {
	formatOverflowCount,
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
	/**
	 * How the "+N" folds in. `pill` (default, headers) is a static chip;
	 * `badge` sits on the last avatar and `bubble` is a grey speech bubble
	 * beside the stack — both open the list of the folded people on click.
	 */
	'overflowStyle'?: 'pill' | 'badge' | 'bubble';
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
	overflowStyle = 'pill',
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
	const { visible, overflow, hidden } = resolveParticipantStack(
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
				overflow > 0 &&
					overflowStyle !== 'pill' &&
					`participantStack--${overflowStyle}`,
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
							role="img"
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
					style={{ zIndex: overflowStyle === 'badge' ? 2 : 0 }}
				>
					{overflowStyle === 'pill' ? (
						<span
							className="participantStack__overflow"
							role="img"
							title={overflowLabel}
							aria-label={overflowLabel}
							data-cy="participant-overflow"
						>
							+{overflow}
						</span>
					) : (
						<OverflowList
							count={overflow}
							label={overflowLabel}
							hidden={hidden}
						/>
					)}
				</li>
			)}
		</ul>
	);
};

export default ParticipantAvatarStack;

/**
 * The "+N" as a button: opens the folded people in a list under it. Rendered
 * in a portal (the card clips its children) and cut off from the card's own
 * click and key handling, so opening it never selects the conversation.
 */
const OverflowList = ({
	count,
	label,
	hidden
}: {
	count: number;
	label: string;
	hidden: StackParticipant[];
}) => {
	const { t: translate } = useTranslation();
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState<DOMRect | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const panelId = useId();

	useEffect(() => {
		if (!open) return;
		// Keyboard users land in the list; Escape there brings them back.
		panelRef.current?.focus();
		const close = () => setOpen(false);
		// Scrolling the list itself must not close it (long lists scroll).
		const closeOnScroll = (event: Event) => {
			if (panelRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.stopPropagation();
			setOpen(false);
			buttonRef.current?.focus();
		};
		const onPointer = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				panelRef.current?.contains(target) ||
				buttonRef.current?.contains(target)
			)
				return;
			setOpen(false);
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onPointer);
		window.addEventListener('resize', close);
		window.addEventListener('scroll', closeOnScroll, true);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onPointer);
			window.removeEventListener('resize', close);
			window.removeEventListener('scroll', closeOnScroll, true);
		};
	}, [open]);

	const stop = (event: React.SyntheticEvent) => event.stopPropagation();
	const onPanelKey = (event: React.KeyboardEvent) => {
		event.stopPropagation();
		if (event.key !== 'Escape') return;
		setOpen(false);
		buttonRef.current?.focus();
	};
	const toggle = (event: React.MouseEvent) => {
		event.stopPropagation();
		setAnchor(buttonRef.current?.getBoundingClientRect() ?? null);
		setOpen((value) => !value);
	};
	const title = translate('chatStage.participants.moreList', {
		count,
		defaultValue: 'Weitere Beteiligte ({{count}})'
	});

	return (
		<>
			<button
				ref={buttonRef}
				type="button"
				className="participantStack__overflow participantStack__overflow--button"
				aria-label={label}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				data-cy="participant-overflow"
				onClick={toggle}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ')
						event.stopPropagation();
				}}
			>
				{formatOverflowCount(count)}
			</button>
			{open &&
				anchor &&
				createPortal(
					<div
						ref={panelRef}
						id={panelId}
						role="dialog"
						tabIndex={-1}
						aria-label={title}
						className="participantStack__list"
						data-cy="participant-overflow-list"
						style={{
							top: anchor.bottom + 8,
							left: Math.max(
								8,
								Math.min(
									anchor.left - 12,
									window.innerWidth - 248
								)
							)
						}}
						onClick={stop}
						onKeyDown={onPanelKey}
						onMouseDown={stop}
					>
						<p className="participantStack__listTitle">{title}</p>
						<ul className="participantStack__listItems">
							{hidden.map((participant) => (
								<li
									key={participant.userId}
									className="participantStack__listItem"
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
										size={32}
									/>
									<span>{participant.displayName}</span>
								</li>
							))}
						</ul>
					</div>,
					document.body
				)}
		</>
	);
};
