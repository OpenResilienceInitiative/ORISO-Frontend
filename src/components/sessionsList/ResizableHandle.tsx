import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';

interface ResizableHandleProps {
	onResize: (width: number) => void;
	currentWidth: number;
	scrollTargetRef?: React.RefObject<HTMLDivElement | null>;
	minWidth?: number;
	maxWidth?: number;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	onResize,
	currentWidth,
	scrollTargetRef,
	minWidth = 80,
	maxWidth = 600
}) => {
	const {
		ICON_ONLY_THRESHOLD,
		SNAP_THRESHOLD,
		SCROLL_THUMB_MIN_PX,
		SCROLL_THUMB_MAX_PX
	} = SESSIONS_LIST_RESIZE;
	const [isDragging, setIsDragging] = useState(false);
	const handleRef = useRef<HTMLButtonElement | null>(null);
	const pointerIdRef = useRef<number | null>(null);
	const dragModeRef = useRef<'pending' | 'resize' | 'scroll'>('pending');
	const dragStartRef = useRef<{
		x: number;
		y: number;
		scrollTop: number;
	} | null>(null);

	const [thumbStyleVars, setThumbStyleVars] = useState<{
		thumbTopPx: number;
		thumbHeightPx: number;
	}>({ thumbTopPx: 0, thumbHeightPx: 56 });
	const rafIdRef = useRef<number | null>(null);

	const updateThumbFromScrollTarget = useCallback(() => {
		const el = scrollTargetRef?.current;
		if (!el) return;

		const view = el.clientHeight;
		const content = el.scrollHeight;
		const maxScrollTop = Math.max(0, content - view);

		// Track space available for the thumb inside the handle column
		const trackHeight = Math.max(0, view);
		// Non-scrollable: keep the pill centered (like the reference).
		if (maxScrollTop <= 0 || trackHeight <= 0) {
			const thumbHeightPx = 40;
			const thumbTopPx = Math.max(
				0,
				Math.round((trackHeight - thumbHeightPx) / 2)
			);
			setThumbStyleVars({ thumbTopPx, thumbHeightPx });
			return;
		}

		// Figma-like small pill: clamp thumb size so it stays compact.
		const MIN_THUMB = SCROLL_THUMB_MIN_PX;
		const MAX_THUMB = SCROLL_THUMB_MAX_PX;
		const idealThumb = (view / content) * trackHeight;
		const thumbHeightPx = Math.max(
			MIN_THUMB,
			Math.min(MAX_THUMB, trackHeight, Math.round(idealThumb))
		);

		const maxThumbTop = Math.max(0, trackHeight - thumbHeightPx);
		const scrollProgress = el.scrollTop / maxScrollTop;

		// Requirement: thumb should not travel into the top half.
		// Map scroll 0..1 → thumbTop center..bottom.
		const centerTop = Math.round(maxThumbTop / 2);
		const travel = Math.max(1, maxThumbTop - centerTop);
		const thumbTopPx = Math.round(centerTop + scrollProgress * travel);

		setThumbStyleVars({ thumbTopPx, thumbHeightPx });
	}, [SCROLL_THUMB_MAX_PX, SCROLL_THUMB_MIN_PX, scrollTargetRef]);

	const scheduleThumbUpdate = useCallback(() => {
		if (rafIdRef.current !== null) return;
		rafIdRef.current = globalThis.requestAnimationFrame(() => {
			rafIdRef.current = null;
			updateThumbFromScrollTarget();
		});
	}, [updateThumbFromScrollTarget]);

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
			dragModeRef.current = 'pending';
			dragStartRef.current = {
				x: e.clientX,
				y: e.clientY,
				scrollTop: scrollTargetRef?.current?.scrollTop ?? 0
			};
			setIsDragging(true);
			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[scrollTargetRef]
	);

	const handlePointerUp = useCallback(() => {
		pointerIdRef.current = null;
		dragModeRef.current = 'pending';
		dragStartRef.current = null;
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
			const start = dragStartRef.current;
			if (!start) {
				applyClientXToWidth(e.clientX);
				return;
			}

			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			const absDx = Math.abs(dx);
			const absDy = Math.abs(dy);

			if (dragModeRef.current === 'pending') {
				const DEADZONE = 6;
				if (absDx < DEADZONE && absDy < DEADZONE) return;
				dragModeRef.current = absDx >= absDy ? 'resize' : 'scroll';
				document.body.style.cursor =
					dragModeRef.current === 'scroll'
						? 'grabbing'
						: 'col-resize';
			}

			if (dragModeRef.current === 'resize') {
				applyClientXToWidth(e.clientX);
				return;
			}

			// Vertical drag scrolls the list (draggable scrollbar requirement).
			const target = scrollTargetRef?.current;
			if (!target) return;
			const view = target.clientHeight;
			const content = target.scrollHeight;
			const maxScrollTop = Math.max(0, content - view);
			if (maxScrollTop <= 0) return;

			// Convert pointer delta → scroll delta using the same center..bottom travel range.
			const trackHeight = Math.max(0, view);
			const MIN_THUMB = SCROLL_THUMB_MIN_PX;
			const MAX_THUMB = SCROLL_THUMB_MAX_PX;
			const idealThumb = (view / content) * trackHeight;
			const thumbHeightPx = Math.max(
				MIN_THUMB,
				Math.min(MAX_THUMB, trackHeight, Math.round(idealThumb))
			);
			const maxThumbTop = Math.max(0, trackHeight - thumbHeightPx);
			const centerTop = Math.round(maxThumbTop / 2);
			const travel = Math.max(1, maxThumbTop - centerTop);
			const scrollPerPx = maxScrollTop / travel;

			target.scrollTop = Math.max(
				0,
				Math.min(maxScrollTop, start.scrollTop + dy * scrollPerPx)
			);
		},
		[
			SCROLL_THUMB_MAX_PX,
			SCROLL_THUMB_MIN_PX,
			applyClientXToWidth,
			isDragging,
			scrollTargetRef
		]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			const resizeStep = e.shiftKey ? 40 : 20;
			const scrollStep = e.shiftKey ? 240 : 120;

			switch (e.key) {
				case 'ArrowLeft':
					e.stopPropagation();
					e.preventDefault();
					onResize(normalizeWidth(currentWidth - resizeStep));
					return;
				case 'ArrowRight':
					e.stopPropagation();
					e.preventDefault();
					onResize(normalizeWidth(currentWidth + resizeStep));
					return;
				case 'ArrowUp': {
					const target = scrollTargetRef?.current;
					if (!target) return;
					e.stopPropagation();
					e.preventDefault();
					target.scrollTop = Math.max(
						0,
						target.scrollTop - scrollStep
					);
					return;
				}
				case 'ArrowDown': {
					const target = scrollTargetRef?.current;
					if (!target) return;
					e.stopPropagation();
					e.preventDefault();
					const maxScrollTop = Math.max(
						0,
						target.scrollHeight - target.clientHeight
					);
					target.scrollTop = Math.min(
						maxScrollTop,
						target.scrollTop + scrollStep
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
					return;
			}
		},
		[
			currentWidth,
			maxWidth,
			minWidth,
			normalizeWidth,
			onResize,
			scrollTargetRef
		]
	);

	useEffect(() => {
		// Keep thumb in sync with scroll position/size
		const el = scrollTargetRef?.current;
		if (!el) return;

		scheduleThumbUpdate();
		const onScroll = () => scheduleThumbUpdate();
		el.addEventListener('scroll', onScroll, { passive: true });

		const ro = new ResizeObserver(() => scheduleThumbUpdate());
		ro.observe(el);

		return () => {
			el.removeEventListener('scroll', onScroll);
			ro.disconnect();
		};
	}, [scheduleThumbUpdate, scrollTargetRef]);

	useEffect(() => {
		return () => {
			if (rafIdRef.current !== null) {
				globalThis.cancelAnimationFrame(rafIdRef.current);
			}
		};
	}, []);

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
			aria-label="Resize sessions list. Drag vertically to scroll the sessions list."
			onPointerDown={(e) => {
				// Make arrow-key control work immediately after hover/click.
				handleRef.current?.focus({ preventScroll: true });
				handlePointerDown(e);
			}}
			onPointerEnter={() => {
				// "Hover" usability: focus the pill so Up/Down works without extra click.
				handleRef.current?.focus({ preventScroll: true });
			}}
			onMouseEnter={() => {
				handleRef.current?.focus({ preventScroll: true });
			}}
			onKeyDown={handleKeyDown}
			style={{
				['--sessionsListThumbTop' as any]: `${thumbStyleVars.thumbTopPx}px`,
				['--sessionsListThumbHeight' as any]: `${thumbStyleVars.thumbHeightPx}px`
			}}
		>
			<span className="sessionsList__resizeHandlePill" />
		</button>
	);
};
