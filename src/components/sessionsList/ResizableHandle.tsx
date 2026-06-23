import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import { ResizeObserver as PolyfillResizeObserver } from '@juggle/resize-observer';
import { useTranslation } from 'react-i18next';

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
	const { t } = useTranslation();
	const {
		ICON_ONLY_THRESHOLD,
		SNAP_THRESHOLD,
		SCROLL_THUMB_MIN_PX,
		SCROLL_THUMB_MAX_PX
	} = SESSIONS_LIST_RESIZE;
	const [isDragging, setIsDragging] = useState(false);
	const handleRef = useRef<HTMLDivElement | null>(null);
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
	const [isScrollable, setIsScrollable] = useState(false);
	const rafIdRef = useRef<number | null>(null);

	const updateThumbFromScrollTarget = useCallback(() => {
		const el = scrollTargetRef?.current;
		if (!el) return;

		// If we're actively resizing horizontally, keep the thumb stable to avoid
		// jitter caused by layout wrapping during drag.
		if (isDragging && dragModeRef.current === 'resize') {
			return;
		}

		const view = el.clientHeight;
		const content = el.scrollHeight;
		const maxScrollTop = Math.max(0, content - view);

		// Track should match the scroll container position in the sidebar so the thumb
		// doesn't jump when header/toolbar height changes.
		const handleRect = handleRef.current?.getBoundingClientRect();
		const scrollRect = el.getBoundingClientRect();
		const trackTopWithinHandle = handleRect
			? Math.max(0, Math.round(scrollRect.top - handleRect.top))
			: 0;
		const trackHeightVisible = Math.round(scrollRect.height || view);

		// When list scrolls, we only want thumb to travel over the scroll container area.
		const handleHeight = trackHeightVisible;
		// Add a small padding so the rounded pill isn't clipped at edges.
		const TRACK_PADDING = 6;
		const trackHeight = Math.max(0, handleHeight - TRACK_PADDING * 2);
		// Non-scrollable: keep the pill centered (like the reference).
		if (maxScrollTop <= 0 || trackHeight <= 0) {
			setIsScrollable(false);
			setThumbStyleVars({ thumbTopPx: 0, thumbHeightPx: 56 });
			return;
		}

		setIsScrollable(true);

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

		// Standard scrollbar mapping: top..bottom.
		const thumbTopPx =
			trackTopWithinHandle +
			TRACK_PADDING +
			Math.round(scrollProgress * maxThumbTop);

		setThumbStyleVars({ thumbTopPx, thumbHeightPx });
	}, [SCROLL_THUMB_MAX_PX, SCROLL_THUMB_MIN_PX, isDragging, scrollTargetRef]);

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
		(e: React.PointerEvent<HTMLDivElement>) => {
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

	const toggleCollapsed = useCallback(() => {
		const next =
			currentWidth <= minWidth + 1 ? ICON_ONLY_THRESHOLD : minWidth;
		onResize(normalizeWidth(next));
	}, [ICON_ONLY_THRESHOLD, currentWidth, minWidth, normalizeWidth, onResize]);

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
				const DEADZONE = 10;
				if (absDx < DEADZONE && absDy < DEADZONE) return;
				/*
				 * Strong bias towards resize:
				 * - scroll mode only when the user is clearly dragging vertically
				 * - prevents accidental scrollTop jumps during left/right resizing
				 */
				const VERTICAL_INTENT_RATIO = 1.8;
				dragModeRef.current =
					absDy >= DEADZONE && absDy >= absDx * VERTICAL_INTENT_RATIO
						? 'scroll'
						: 'resize';
				document.body.style.cursor =
					dragModeRef.current === 'scroll'
						? 'grabbing'
						: 'col-resize';
			}

			if (dragModeRef.current === 'resize') {
				// Never let resize affect list scroll position.
				const target = scrollTargetRef?.current;
				if (target && start.scrollTop !== undefined) {
					target.scrollTop = start.scrollTop;
				}
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

			// Convert pointer delta → scroll delta using full thumb travel range.
			const TRACK_PADDING = 6;
			const scrollRect = target.getBoundingClientRect();
			const trackHeightVisible = Math.round(scrollRect.height || view);
			const trackHeight = Math.max(
				0,
				trackHeightVisible - TRACK_PADDING * 2
			);
			const MIN_THUMB = SCROLL_THUMB_MIN_PX;
			const MAX_THUMB = SCROLL_THUMB_MAX_PX;
			const idealThumb = (view / content) * trackHeight;
			const thumbHeightPx = Math.max(
				MIN_THUMB,
				Math.min(MAX_THUMB, trackHeight, Math.round(idealThumb))
			);
			const maxThumbTop = Math.max(0, trackHeight - thumbHeightPx);
			const travel = Math.max(1, maxThumbTop);
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
		(e: React.KeyboardEvent<HTMLDivElement>) => {
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

		const RO = globalThis.ResizeObserver ?? PolyfillResizeObserver;
		const ro = new RO(() => scheduleThumbUpdate());
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

	useEffect(() => {
		// Safety net: never leak body styles on unmount.
		return () => {
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, []);

	return (
		<div
			ref={handleRef}
			className="sessionsList__resizeHandle"
			data-dragging={isDragging ? 'true' : 'false'}
			data-scrollable={isScrollable ? 'true' : 'false'}
			role="separator"
			// sonar: role="separator" is an interactive widget when focusable + keyboard-handled
			tabIndex={0}
			aria-orientation="vertical"
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			aria-valuenow={currentWidth}
			aria-label={t(
				'sessionList.resizeHandle.ariaLabel',
				'Resize sessions list. Drag vertically to scroll the sessions list.'
			)}
			onDoubleClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				toggleCollapsed();
			}}
			onWheel={(e) => {
				// UX: a small wheel gesture on the handle should toggle open/close
				// (requested behavior). Keep it gated so it won't trigger on tiny noise.
				if (isDragging) return;
				const delta = Math.abs(e.deltaY) + Math.abs(e.deltaX);
				if (delta < 4) return;
				e.preventDefault();
				e.stopPropagation();
				toggleCollapsed();
			}}
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
					['--sessions-list-thumb-top' as any]: `${thumbStyleVars.thumbTopPx}px`,
					['--sessions-list-thumb-height' as any]: `${thumbStyleVars.thumbHeightPx}px`
				}}
			>
			<span className="sessionsList__resizeHandlePill" />
		</div>
	);
};
