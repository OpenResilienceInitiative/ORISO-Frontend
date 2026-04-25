import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';

interface ResizableHandleProps {
	onResize: (width: number) => void;
	currentWidth: number;
	minWidth?: number;
	maxWidth?: number;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	onResize,
	currentWidth,
	minWidth = 80,
	maxWidth = 600
}) => {
	const { ICON_ONLY_THRESHOLD, SNAP_THRESHOLD } = SESSIONS_LIST_RESIZE;
	const [isDragging, setIsDragging] = useState(false);
	const handleRef = useRef<HTMLButtonElement | null>(null);
	const pointerIdRef = useRef<number | null>(null);

	const normalizeWidth = useCallback(
		(width: number) => {
			let nextWidth = Math.min(Math.max(width, minWidth), maxWidth);

			// Snap out of the "broken/truncated" mid-range earlier.
			if (nextWidth > minWidth && nextWidth < ICON_ONLY_THRESHOLD) {
				nextWidth =
					nextWidth < SNAP_THRESHOLD ? minWidth : ICON_ONLY_THRESHOLD;
			}

			return nextWidth;
		},
		[ICON_ONLY_THRESHOLD, SNAP_THRESHOLD, maxWidth, minWidth]
	);

	const applyClientXToWidth = useCallback(
		(clientX: number) => {
			const wrapperRect =
				handleRef.current?.parentElement?.getBoundingClientRect();
			const rawWidth = wrapperRect ? clientX - wrapperRect.left : clientX;
			onResize(normalizeWidth(rawWidth));
		},
		[normalizeWidth, onResize]
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			// Only react to primary button / touch contact
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();

			pointerIdRef.current = e.pointerId;
			setIsDragging(true);
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[]
	);

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
			)
				return;
			applyClientXToWidth(e.clientX);
		},
		[applyClientXToWidth, isDragging]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			const STEP = e.shiftKey ? 40 : 20;
			let nextWidth: number | null = null;

			switch (e.key) {
				case 'ArrowLeft':
					nextWidth = currentWidth - STEP;
					break;
				case 'ArrowRight':
					nextWidth = currentWidth + STEP;
					break;
				case 'Home':
					nextWidth = minWidth;
					break;
				case 'End':
					nextWidth = maxWidth;
					break;
				default:
					return;
			}

			e.preventDefault();
			onResize(normalizeWidth(nextWidth));
		},
		[currentWidth, maxWidth, minWidth, normalizeWidth, onResize]
	);

	useEffect(() => {
		if (isDragging) {
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
		}
	}, [isDragging, handlePointerMove, handlePointerUp]);

	return (
		<button
			type="button"
			ref={handleRef}
			className="sessionsList__resizeHandle"
			data-dragging={isDragging ? 'true' : 'false'}
			// Not using role="separator" because it conflicts with native button semantics.
			aria-label="Resize sessions list"
			aria-orientation="vertical"
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-valuenow={currentWidth}
			onPointerDown={handlePointerDown}
			onKeyDown={handleKeyDown}
		>
			<span className="sessionsList__resizeHandlePill" />
		</button>
	);
};
