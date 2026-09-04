/**
 * WP-B1 (PLAN-supervision-parallel-panel-2026-09-04) — the expanded
 * supervision panel: a parallel chat that sits *next to* the client chat,
 * never inside it and never a mere thread.
 *
 * Presentational only. It owns no transport: the timeline arrives as
 * `children`, the composer through `renderComposer`, and geometry through
 * `frame` / `onFrameChange`. See README.md for the B2 wiring.
 */
import * as React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, CollapseIcon, GripIcon } from './icons';
import { DragDelta, useDragHandle } from './useDragHandle';
import './supervisionPanel.styles.scss';

export type SupervisionViewerRole = 'consultant' | 'supervisor';

export interface SupervisionPanelFrame {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface SupervisionPanelProps {
	/**
	 * The person on the other side of this channel. For a consultant that is
	 * the supervisor; for a supervisor it is the responsible consultant.
	 */
	'counterpartName': string;
	/** Who is looking — decides the role chip shown next to the name. */
	'viewerRole': SupervisionViewerRole;
	'unreadCount'?: number;
	/** When collapsed the panel renders nothing; `SupervisionPanelMini` takes over. */
	'isCollapsed'?: boolean;
	'onCollapse'?: () => void;
	'onClose'?: () => void;
	/** Timeline content (message bubbles). Empty → built-in empty state. */
	'children'?: React.ReactNode;
	/** Composer slot; the container supplies the real message composer in B2. */
	'renderComposer'?: () => React.ReactNode;
	/**
	 * Floating geometry. When set, the panel positions itself absolutely inside
	 * its offset parent and the drag handle moves / resizes it through
	 * `onFrameChange`. Without a frame the panel fills its parent (split mode).
	 */
	'frame'?: SupervisionPanelFrame;
	'onFrameChange'?: (frame: SupervisionPanelFrame) => void;
	'minWidth'?: number;
	'minHeight'?: number;
	/** Raw handle deltas, for owners that hold geometry in another shape. */
	'onDragMove'?: (delta: DragDelta) => void;
	'onDragResize'?: (delta: DragDelta) => void;
	/** Runs before the built-in arrow-key handling; `preventDefault()` replaces it. */
	'onDragHandleKey'?: (event: React.KeyboardEvent<HTMLElement>) => void;
	'className'?: string;
	'data-cy'?: string;
}

export const SupervisionPanel = ({
	counterpartName,
	viewerRole,
	unreadCount = 0,
	isCollapsed = false,
	onCollapse,
	onClose,
	children,
	renderComposer,
	frame,
	onFrameChange,
	minWidth = 320,
	minHeight = 280,
	onDragMove,
	onDragResize,
	onDragHandleKey,
	className,
	'data-cy': dataCy = 'supervision-panel'
}: SupervisionPanelProps) => {
	const { t: translate } = useTranslation();

	// Pointer moves can arrive faster than the owner re-renders; applying each
	// delta to the last *emitted* frame (not the last rendered prop) keeps
	// them accumulating instead of overwriting each other.
	const frameRef = useRef(frame);
	frameRef.current = frame;
	const emitFrame = useCallback(
		(next: SupervisionPanelFrame) => {
			frameRef.current = next;
			onFrameChange?.(next);
		},
		[onFrameChange]
	);

	const move = useCallback(
		(delta: DragDelta) => {
			onDragMove?.(delta);
			const current = frameRef.current;
			if (current && onFrameChange) {
				emitFrame({
					...current,
					x: Math.max(0, current.x + delta.dx),
					y: Math.max(0, current.y + delta.dy)
				});
			}
		},
		[onFrameChange, onDragMove, emitFrame]
	);

	const resize = useCallback(
		(delta: DragDelta) => {
			onDragResize?.(delta);
			const current = frameRef.current;
			if (current && onFrameChange) {
				emitFrame({
					...current,
					width: Math.max(minWidth, current.width + delta.dx),
					height: Math.max(minHeight, current.height + delta.dy)
				});
			}
		},
		[onFrameChange, onDragResize, emitFrame, minWidth, minHeight]
	);

	const canMove = !!(onDragMove || (frame && onFrameChange));
	const canResize = !!(onDragResize || (frame && onFrameChange));
	const { handleProps } = useDragHandle({
		onMove: canMove ? move : undefined,
		onResize: canResize ? resize : undefined,
		onKeyDown: onDragHandleKey
	});

	if (isCollapsed) {
		return null;
	}

	const roleChip = translate(
		viewerRole === 'consultant'
			? 'supervision.panel.role.supervisor'
			: 'supervision.panel.role.consultant'
	);
	const headerLabel = translate('supervision.panel.headerLabel', {
		name: counterpartName
	});
	// toArray drops null / boolean children, so `{cond && <Bubbles/>}` with a
	// false condition still yields the empty state.
	const hasMessages = React.Children.toArray(children).length > 0;
	const classes = [
		'supervisionPanel',
		frame ? 'supervisionPanel--floating' : 'supervisionPanel--docked',
		className
	]
		.filter(Boolean)
		.join(' ');

	return (
		<section
			className={classes}
			data-cy={dataCy}
			aria-label={headerLabel}
			style={
				frame
					? {
							left: frame.x,
							top: frame.y,
							width: frame.width,
							height: frame.height
						}
					: undefined
			}
		>
			<header className="supervisionPanel__header">
				<button
					type="button"
					className="supervisionPanel__grip"
					aria-label={translate('supervision.panel.dragHandle')}
					title={translate('supervision.panel.dragHandle')}
					data-cy="supervision-panel-drag-handle"
					{...handleProps}
				>
					<GripIcon />
				</button>
				<div className="supervisionPanel__titleBlock">
					<h2 className="supervisionPanel__title">
						<span className="supervisionPanel__titleLabel">
							{translate('supervision.panel.title')}
						</span>
						<span
							className="supervisionPanel__titleSeparator"
							aria-hidden="true"
						>
							·
						</span>
						<span
							className="supervisionPanel__titleName"
							data-cy="supervision-panel-counterpart"
						>
							{counterpartName}
						</span>
						<span
							className="supervisionPanel__roleChip"
							data-cy="supervision-panel-role"
						>
							{roleChip}
						</span>
						{unreadCount > 0 && (
							<span
								className="supervisionPanel__unread"
								data-cy="supervision-panel-unread"
								aria-label={translate(
									'supervision.panel.unread',
									{ count: unreadCount }
								)}
							>
								{unreadCount}
							</span>
						)}
					</h2>
					<p className="supervisionPanel__privacyHint">
						{translate('supervision.panel.privacyHint')}
					</p>
				</div>
				<div className="supervisionPanel__actions">
					<button
						type="button"
						className="supervisionPanel__iconButton"
						onClick={onCollapse}
						disabled={!onCollapse}
						aria-label={translate('supervision.panel.collapse')}
						title={translate('supervision.panel.collapse')}
						data-cy="supervision-panel-collapse"
					>
						<CollapseIcon />
					</button>
					<button
						type="button"
						className="supervisionPanel__iconButton"
						onClick={onClose}
						disabled={!onClose}
						aria-label={translate('supervision.panel.close')}
						title={translate('supervision.panel.close')}
						data-cy="supervision-panel-close"
					>
						<CloseIcon />
					</button>
				</div>
			</header>

			<div
				className="supervisionPanel__timeline"
				role="log"
				aria-live="polite"
				data-cy="supervision-panel-timeline"
			>
				{hasMessages ? (
					children
				) : (
					<div
						className="supervisionPanel__empty"
						data-cy="supervision-panel-empty"
					>
						<p className="supervisionPanel__emptyTitle">
							{translate('supervision.panel.empty.title')}
						</p>
						<p className="supervisionPanel__emptyHint">
							{translate('supervision.panel.empty.hint', {
								name: counterpartName
							})}
						</p>
					</div>
				)}
			</div>

			{renderComposer && (
				<div
					className="supervisionPanel__composer"
					data-cy="supervision-panel-composer"
				>
					{renderComposer()}
				</div>
			)}
		</section>
	);
};

export default SupervisionPanel;
