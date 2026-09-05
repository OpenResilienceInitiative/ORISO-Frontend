/**
 * Shared pointer + keyboard drag behaviour for the supervision panel family.
 *
 * The hook is deliberately stateless about *where* things end up: it reports
 * deltas and the owner applies them to whatever geometry it holds (a floating
 * frame, a bottom-right offset, a divider position). That keeps the panel,
 * the miniature and the split divider on one interaction model:
 *
 * - pointer drag (mouse, touch, pen via Pointer Events, with capture)
 * - arrow keys move by `step` px; Shift + arrow resizes when `onResize` exists
 * - `onKeyDown` runs first and may `preventDefault()` to replace the defaults
 */
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';

export interface DragDelta {
	dx: number;
	dy: number;
}

export interface UseDragHandleOptions {
	onMove?: (delta: DragDelta) => void;
	onResize?: (delta: DragDelta) => void;
	onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
	onDragStart?: () => void;
	onDragEnd?: (moved: boolean) => void;
	/** Pixels per arrow-key press. */
	step?: number;
	/** Pointer travel (px) below which a press still counts as a click. */
	clickThreshold?: number;
	disabled?: boolean;
}

export interface DragHandleProps {
	'onPointerDown': (event: React.PointerEvent<HTMLElement>) => void;
	'onPointerMove': (event: React.PointerEvent<HTMLElement>) => void;
	'onPointerUp': (event: React.PointerEvent<HTMLElement>) => void;
	'onPointerCancel': (event: React.PointerEvent<HTMLElement>) => void;
	'onKeyDown': (event: React.KeyboardEvent<HTMLElement>) => void;
	'data-dragging': 'true' | 'false';
}

export interface UseDragHandleResult {
	handleProps: DragHandleProps;
	isDragging: boolean;
	/**
	 * True when the pointer travelled past `clickThreshold` during the last
	 * press. Owners that make the handle itself clickable (the FAB) read this
	 * in `onClick` to swallow the click that follows a drag.
	 */
	consumeDragged: () => boolean;
}

const ARROW_DELTAS: Record<string, DragDelta> = {
	ArrowLeft: { dx: -1, dy: 0 },
	ArrowRight: { dx: 1, dy: 0 },
	ArrowUp: { dx: 0, dy: -1 },
	ArrowDown: { dx: 0, dy: 1 }
};

export const useDragHandle = ({
	onMove,
	onResize,
	onKeyDown,
	onDragStart,
	onDragEnd,
	step = 16,
	clickThreshold = 6,
	disabled = false
}: UseDragHandleOptions): UseDragHandleResult => {
	const [isDragging, setIsDragging] = useState(false);
	const lastPoint = useRef<{ x: number; y: number } | null>(null);
	const travelled = useRef(0);
	const draggedFlag = useRef(false);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (disabled || !onMove || event.button !== 0) {
				return;
			}
			lastPoint.current = { x: event.clientX, y: event.clientY };
			travelled.current = 0;
			draggedFlag.current = false;
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {
				// Synthetic or already-released pointer — dragging still works,
				// we just don't get capture.
			}
			setIsDragging(true);
			onDragStart?.();
		},
		[disabled, onMove, onDragStart]
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (!lastPoint.current || !onMove) {
				return;
			}
			const dx = event.clientX - lastPoint.current.x;
			const dy = event.clientY - lastPoint.current.y;
			if (dx === 0 && dy === 0) {
				return;
			}
			lastPoint.current = { x: event.clientX, y: event.clientY };
			travelled.current += Math.abs(dx) + Math.abs(dy);
			if (travelled.current > clickThreshold) {
				draggedFlag.current = true;
			}
			onMove({ dx, dy });
		},
		[onMove, clickThreshold]
	);

	const endDrag = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (!lastPoint.current) {
				return;
			}
			lastPoint.current = null;
			try {
				if (event.currentTarget.hasPointerCapture(event.pointerId)) {
					event.currentTarget.releasePointerCapture(event.pointerId);
				}
			} catch {
				// see setPointerCapture above
			}
			setIsDragging(false);
			onDragEnd?.(draggedFlag.current);
		},
		[onDragEnd]
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			onKeyDown?.(event);
			if (event.defaultPrevented || disabled) {
				return;
			}
			const unit = ARROW_DELTAS[event.key];
			if (!unit) {
				return;
			}
			const delta = { dx: unit.dx * step, dy: unit.dy * step };
			if (event.shiftKey) {
				if (!onResize) {
					return;
				}
				event.preventDefault();
				onResize(delta);
				return;
			}
			if (!onMove) {
				return;
			}
			event.preventDefault();
			onMove(delta);
		},
		[onKeyDown, disabled, step, onMove, onResize]
	);

	const consumeDragged = useCallback(() => {
		const value = draggedFlag.current;
		draggedFlag.current = false;
		return value;
	}, []);

	return {
		handleProps: {
			'onPointerDown': handlePointerDown,
			'onPointerMove': handlePointerMove,
			'onPointerUp': endDrag,
			'onPointerCancel': endDrag,
			'onKeyDown': handleKeyDown,
			'data-dragging': isDragging ? 'true' : 'false'
		},
		isDragging,
		consumeDragged
	};
};
