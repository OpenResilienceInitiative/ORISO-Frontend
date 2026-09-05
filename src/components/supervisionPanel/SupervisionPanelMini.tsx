/**
 * WP-B1 — the collapsed miniature of a side conversation.
 *
 * Two variants on one API:
 * - `card`: floating card hovering above the chat (desktop) — avatar, name,
 *   unread badge, one-line snippet, pulse when something new arrived.
 * - `fab`: round button bottom-right (narrow viewports) — icon + badge. It is
 *   the mobile switcher between the main chat and the full-screen side room.
 *
 * `kind` only changes icon and label so a thread can reuse the switcher.
 */
import * as React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SupervisionIcon, ThreadIcon, GripIcon } from './icons';
import { DragDelta, useDragHandle } from './useDragHandle';
import './supervisionPanel.styles.scss';

export type SupervisionMiniVariant = 'card' | 'fab';
export type SupervisionMiniKind = 'supervision' | 'thread';

/** Offset from the bottom-right corner of the positioning parent. */
export interface SupervisionMiniPosition {
	right: number;
	bottom: number;
}

export const DEFAULT_MINI_POSITION: SupervisionMiniPosition = {
	right: 16,
	bottom: 16
};

export interface SupervisionPanelMiniProps {
	'variant'?: SupervisionMiniVariant;
	'kind'?: SupervisionMiniKind;
	/** Counterpart display name (card) / accessible name (fab). */
	'name': string;
	/** Avatar letter; defaults to the first character of `name`. */
	'initial'?: string;
	'avatarUrl'?: string;
	'unreadCount'?: number;
	/** Last message, rendered on one line with an ellipsis (card only). */
	'lastMessage'?: string;
	/** Highlight + pulse: a message arrived while collapsed. */
	'hasNewMessage'?: boolean;
	'onExpand': () => void;
	/** Controlled position; omit for the default bottom-right corner. */
	'position'?: SupervisionMiniPosition;
	'onPositionChange'?: (position: SupervisionMiniPosition) => void;
	/** `absolute` inside a relative chat container (default) or `fixed` to the viewport. */
	'positionMode'?: 'absolute' | 'fixed';
	'className'?: string;
	'data-cy'?: string;
}

const clampOffset = (value: number) => Math.max(0, Math.round(value));

export const SupervisionPanelMini = ({
	variant = 'card',
	kind = 'supervision',
	name,
	initial,
	avatarUrl,
	unreadCount = 0,
	lastMessage,
	hasNewMessage = false,
	onExpand,
	position = DEFAULT_MINI_POSITION,
	onPositionChange,
	positionMode = 'absolute',
	className,
	'data-cy': dataCy = 'supervision-mini'
}: SupervisionPanelMiniProps) => {
	const { t: translate } = useTranslation();

	// See SupervisionPanel: apply deltas to the last emitted position so
	// pointer moves between renders accumulate.
	const positionRef = useRef(position);
	positionRef.current = position;
	const move = useCallback(
		(delta: DragDelta) => {
			const current = positionRef.current;
			const next = {
				right: clampOffset(current.right - delta.dx),
				bottom: clampOffset(current.bottom - delta.dy)
			};
			positionRef.current = next;
			onPositionChange?.(next);
		},
		[onPositionChange]
	);

	const { handleProps, consumeDragged, isDragging } = useDragHandle({
		onMove: onPositionChange ? move : undefined
	});

	const kindLabel = translate(`supervision.panel.kind.${kind}`);
	const unreadLabel =
		unreadCount > 0
			? translate('supervision.panel.unread', { count: unreadCount })
			: '';
	const expandLabel = [
		translate('supervision.panel.mini.expand', { kind: kindLabel }),
		name,
		unreadLabel,
		hasNewMessage ? translate('supervision.panel.mini.newMessage') : ''
	]
		.filter(Boolean)
		.join(' – ');

	const Icon = kind === 'thread' ? ThreadIcon : SupervisionIcon;
	const style: React.CSSProperties = {
		position: positionMode,
		right: position.right,
		bottom: position.bottom
	};
	const classes = [
		'supervisionMini',
		`supervisionMini--${variant}`,
		`supervisionMini--${kind}`,
		hasNewMessage && 'supervisionMini--pulse',
		isDragging && 'supervisionMini--dragging',
		className
	]
		.filter(Boolean)
		.join(' ');

	const badge = unreadCount > 0 && (
		<span
			className="supervisionMini__badge"
			data-cy="supervision-mini-unread"
			aria-hidden="true"
		>
			{unreadCount > 99 ? '99+' : unreadCount}
		</span>
	);

	if (variant === 'fab') {
		// The FAB is its own drag surface: a short press expands, a drag moves.
		const { onKeyDown, ...pointerProps } = handleProps;
		return (
			<button
				type="button"
				className={classes}
				style={style}
				data-cy={dataCy}
				data-kind={kind}
				aria-label={expandLabel}
				title={expandLabel}
				onClick={() => {
					if (!consumeDragged()) {
						onExpand();
					}
				}}
				onKeyDown={onKeyDown}
				{...pointerProps}
			>
				<Icon className="supervisionMini__fabIcon" />
				{badge}
			</button>
		);
	}

	return (
		<div
			className={classes}
			style={style}
			data-cy={dataCy}
			data-kind={kind}
		>
			<button
				type="button"
				className="supervisionMini__grip"
				aria-label={translate('supervision.panel.mini.dragHandle')}
				title={translate('supervision.panel.mini.dragHandle')}
				data-cy="supervision-mini-drag-handle"
				{...handleProps}
			>
				<GripIcon />
			</button>
			<button
				type="button"
				className="supervisionMini__body"
				onClick={onExpand}
				aria-label={expandLabel}
				data-cy="supervision-mini-expand"
			>
				<span className="supervisionMini__avatar" aria-hidden="true">
					{avatarUrl ? (
						<img src={avatarUrl} alt="" />
					) : (
						(initial ?? name.charAt(0)).toUpperCase()
					)}
				</span>
				<span className="supervisionMini__text">
					<span className="supervisionMini__kind">{kindLabel}</span>
					<span className="supervisionMini__name">{name}</span>
					<span
						className="supervisionMini__snippet"
						data-cy="supervision-mini-snippet"
					>
						{lastMessage ??
							translate('supervision.panel.empty.title')}
					</span>
				</span>
				{badge}
			</button>
		</div>
	);
};

export default SupervisionPanelMini;
