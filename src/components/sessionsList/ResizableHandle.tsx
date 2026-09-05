/**
 * Resize handle between two panes — Figma "Drag Handle" (1320:38281 →
 * Chat Room Desktop): a 24 px hit zone on one edge of the element it
 * resizes with an 8 × 48 px `primary-fixed-dim` pill vertically centred on
 * the element's full height (T5: never coupled to the list's scrollbar, no
 * chevron button at the list edge any more).
 *
 * Used by the session list column (`anchor="end"`, list snapping) and by
 * the chat's side panel (`anchor="start"`, T2). Math in
 * `resizableHandleMath.ts`.
 */
import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import {
	clampWidth,
	getToggledSidebarWidth,
	snapSessionsListWidth,
	widthFromPointer,
	type ResizeAnchor
} from './resizableHandleMath';

export { getToggledSidebarWidth } from './resizableHandleMath';

interface ResizableHandleProps {
	'onResize': (width: number) => void;
	'currentWidth': number;
	/** Keyboard Up/Down scroll this container (the list); optional. */
	'scrollTargetRef'?: React.RefObject<HTMLDivElement | null>;
	'minWidth'?: number;
	'maxWidth'?: number;
	/** Which edge of the resized element the handle sits on (default: end). */
	'anchor'?: ResizeAnchor;
	/** Session-list snapping (icon rail ↔ expanded band). Off for panels. */
	'snapping'?: boolean;
	'ariaLabel'?: string;
	'className'?: string;
	'data-cy'?: string;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	onResize,
	currentWidth,
	scrollTargetRef,
	minWidth = 80,
	maxWidth = 600,
	anchor = 'end',
	snapping = true,
	ariaLabel,
	className,
	'data-cy': dataCy = 'resizable-handle'
}) => {
	const { t } = useTranslation();
	const { EXPANDED_MIN_WIDTH } = SESSIONS_LIST_RESIZE;
	const [isDragging, setIsDragging] = useState(false);
	const handleRef = useRef<HTMLDivElement | null>(null);
	const pointerIdRef = useRef<number | null>(null);

	const normalizeWidth = useCallback(
		(width: number) =>
			snapping
				? snapSessionsListWidth(width, minWidth, maxWidth)
				: clampWidth(width, minWidth, maxWidth),
		[maxWidth, minWidth, snapping]
	);

	const applyClientXToWidth = useCallback(
		(clientX: number) => {
			const rect =
				handleRef.current?.parentElement?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			onResize(
				normalizeWidth(
					widthFromPointer({
						clientX,
						left: rect.left,
						right: rect.right,
						anchor
					})
				)
			);
		},
		[anchor, normalizeWidth, onResize]
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			pointerIdRef.current = e.pointerId;
			setIsDragging(true);
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[]
	);

	const toggleCollapsed = useCallback(() => {
		onResize(
			normalizeWidth(
				getToggledSidebarWidth(
					currentWidth,
					minWidth,
					snapping ? EXPANDED_MIN_WIDTH : maxWidth
				)
			)
		);
	}, [
		EXPANDED_MIN_WIDTH,
		currentWidth,
		maxWidth,
		minWidth,
		normalizeWidth,
		onResize,
		snapping
	]);

	const handlePointerUp = useCallback(() => {
		pointerIdRef.current = null;
		setIsDragging(false);
	}, []);

	const handlePointerMove = useCallback(
		(e: PointerEvent) => {
			if (!isDragging) return;
			if (
				pointerIdRef.current !== null &&
				e.pointerId !== pointerIdRef.current
			) {
				return;
			}
			applyClientXToWidth(e.clientX);
		},
		[applyClientXToWidth, isDragging]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const resizeStep = e.shiftKey ? 40 : 20;
			const scrollStep = e.shiftKey ? 240 : 120;
			// With the handle on the start edge, "left" makes the pane wider.
			const direction = anchor === 'start' ? -1 : 1;

			switch (e.key) {
				case 'ArrowLeft':
					e.stopPropagation();
					e.preventDefault();
					onResize(
						normalizeWidth(currentWidth - direction * resizeStep)
					);
					return;
				case 'ArrowRight':
					e.stopPropagation();
					e.preventDefault();
					onResize(
						normalizeWidth(currentWidth + direction * resizeStep)
					);
					return;
				case 'ArrowUp':
				case 'ArrowDown': {
					const target = scrollTargetRef?.current;
					if (!target) return;
					e.stopPropagation();
					e.preventDefault();
					const maxScrollTop = Math.max(
						0,
						target.scrollHeight - target.clientHeight
					);
					const delta =
						e.key === 'ArrowUp' ? -scrollStep : scrollStep;
					target.scrollTop = Math.min(
						maxScrollTop,
						Math.max(0, target.scrollTop + delta)
					);
					return;
				}
				case 'Home':
					e.stopPropagation();
					e.preventDefault();
					onResize(normalizeWidth(minWidth));
					return;
				case 'End':
					e.stopPropagation();
					e.preventDefault();
					onResize(normalizeWidth(maxWidth));
					return;
				default:
			}
		},
		[
			anchor,
			currentWidth,
			maxWidth,
			minWidth,
			normalizeWidth,
			onResize,
			scrollTargetRef
		]
	);

	useEffect(() => {
		if (!isDragging) {
			return undefined;
		}
		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
		document.addEventListener('pointercancel', handlePointerUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		return () => {
			document.removeEventListener('pointermove', handlePointerMove);
			document.removeEventListener('pointerup', handlePointerUp);
			document.removeEventListener('pointercancel', handlePointerUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, [isDragging, handlePointerMove, handlePointerUp]);

	useEffect(
		() => () => {
			// Safety net: never leak body styles on unmount.
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		},
		[]
	);

	return (
		<div
			ref={handleRef}
			className={[
				'sessionsList__resizeHandle',
				`sessionsList__resizeHandle--${anchor}`,
				className
			]
				.filter(Boolean)
				.join(' ')}
			data-dragging={isDragging ? 'true' : 'false'}
			data-cy={dataCy}
			role="separator"
			// sonar: role="separator" is an interactive widget when focusable + keyboard-handled
			tabIndex={0}
			aria-orientation="vertical"
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-valuenow={currentWidth}
			aria-label={
				ariaLabel ??
				t(
					'sessionList.resizeHandle.ariaLabel',
					'Resize sessions list. Drag vertically to scroll the sessions list.'
				)
			}
			onDoubleClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleCollapsed();
			}}
			onPointerDown={(e) => {
				// Make arrow-key control work immediately after hover/click.
				handleRef.current?.focus({ preventScroll: true });
				handlePointerDown(e);
			}}
			onKeyDown={handleKeyDown}
		>
			<span className="sessionsList__resizeHandlePill" />
		</div>
	);
};
