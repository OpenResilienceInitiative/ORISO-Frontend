import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import { ResizeObserver as PolyfillResizeObserver } from '@juggle/resize-observer';
import { useTranslation } from 'react-i18next';

export type ResizableHandleMode = 'resizeAndScroll' | 'scroll';

interface ResizableHandleProps {
	/**
	 * 'resizeAndScroll' (default) is the sessions-list behaviour: drag
	 * sideways to resize the pane, vertically to scroll it.
	 *
	 * 'scroll' drops the resize half for surfaces that scroll but have no
	 * width of their own to give - the threads dropdown is fixed at
	 * min(360px, 100% - 32px), so a resize drag there would have nothing to
	 * act on (ORISO-Frontend#1196 job 2).
	 */
	mode?: ResizableHandleMode;
	/** Required in 'resizeAndScroll'; ignored in 'scroll'. */
	onResize?: (width: number) => void;
	/** Required in 'resizeAndScroll'; ignored in 'scroll'. */
	currentWidth?: number;
	scrollTargetRef?: React.RefObject<HTMLDivElement | null>;
	/** Extra class for placement; the base class carries the behaviour styles. */
	className?: string;
	minWidth?: number;
	maxWidth?: number;
}

export const getToggledSidebarWidth = (
	currentWidth: number,
	minWidth: number,
	expandedMinWidth: number
) => (currentWidth <= minWidth + 1 ? expandedMinWidth : minWidth);

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	mode = 'resizeAndScroll',
	onResize,
	currentWidth = 0,
	scrollTargetRef,
	className,
	minWidth = 80,
	maxWidth = 600
}) => {
	const isScrollOnly = mode === 'scroll';
	const { t } = useTranslation();
	const {
		ICON_ONLY_THRESHOLD,
		SNAP_THRESHOLD,
		EXPANDED_MIN_WIDTH,
		EXPANDED_SNAP_THRESHOLD,
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

	const [isScrollable, setIsScrollable] = useState(false);
	const [scrollPercent, setScrollPercent] = useState(0);
	const rafIdRef = useRef<number | null>(null);

	/**
	 * The bar is a handle, not a scrollbar thumb: it keeps its place when the
	 * list overflows, and the scroll area behind it stays invisible
	 * (ORISO-Frontend#1196). So only two things are tracked - whether there is
	 * anything to scroll, and how far down we are for the scrollbar role's
	 * aria value. No geometry is pushed into CSS any more.
	 */
	const updateScrollState = useCallback(() => {
		const el = scrollTargetRef?.current;
		if (!el) return;

		// Mid-resize the list re-wraps and re-measures; leaving the state alone
		// keeps the bar from flickering while the pointer is down.
		if (isDragging && dragModeRef.current === 'resize') {
			return;
		}

		const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
		if (maxScrollTop <= 0) {
			setIsScrollable(false);
			setScrollPercent(0);
			return;
		}

		setIsScrollable(true);
		setScrollPercent(Math.round((el.scrollTop / maxScrollTop) * 100));
	}, [isDragging, scrollTargetRef]);

	const scheduleScrollStateUpdate = useCallback(() => {
		if (rafIdRef.current !== null) return;
		rafIdRef.current = globalThis.requestAnimationFrame(() => {
			rafIdRef.current = null;
			updateScrollState();
		});
	}, [updateScrollState]);

	const normalizeWidth = useCallback(
		(width: number) => {
			let nextWidth = Math.min(Math.max(width, minWidth), maxWidth);

			// Snap out of the "broken/truncated" mid-range earlier.
			if (nextWidth > minWidth && nextWidth < ICON_ONLY_THRESHOLD) {
				nextWidth =
					nextWidth < SNAP_THRESHOLD ? minWidth : ICON_ONLY_THRESHOLD;
			}

			// Snap the gap between the icon-only rail and the expanded desktop
			// minimum (Figma node 115): the list is either compact (icon-only)
			// or at least `EXPANDED_MIN_WIDTH` wide — never stranded between.
			if (
				nextWidth > ICON_ONLY_THRESHOLD &&
				nextWidth < EXPANDED_MIN_WIDTH
			) {
				nextWidth =
					nextWidth < EXPANDED_SNAP_THRESHOLD
						? ICON_ONLY_THRESHOLD
						: EXPANDED_MIN_WIDTH;
			}

			return nextWidth;
		},
		[
			EXPANDED_MIN_WIDTH,
			EXPANDED_SNAP_THRESHOLD,
			ICON_ONLY_THRESHOLD,
			SNAP_THRESHOLD,
			maxWidth,
			minWidth
		]
	);

	const applyClientXToWidth = useCallback(
		(clientX: number) => {
			const wrapperRect =
				handleRef.current?.parentElement?.getBoundingClientRect();
			const rawWidth = wrapperRect ? clientX - wrapperRect.left : clientX;
			onResize?.(normalizeWidth(rawWidth));
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
		const next = getToggledSidebarWidth(
			currentWidth,
			minWidth,
			EXPANDED_MIN_WIDTH
		);
		onResize(normalizeWidth(next));
	}, [EXPANDED_MIN_WIDTH, currentWidth, minWidth, normalizeWidth, onResize]);

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
				dragModeRef.current = isScrollOnly
					? 'scroll'
					: absDy >= DEADZONE && absDy >= absDx * VERTICAL_INTENT_RATIO
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
			isScrollOnly,
			scrollTargetRef
		]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const resizeStep = e.shiftKey ? 40 : 20;
			const scrollStep = e.shiftKey ? 240 : 120;

			// Left/Right and the width bounds only mean something when there is
			// a width to change.
			if (isScrollOnly) {
				const target = scrollTargetRef?.current;
				if (!target) return;
				const maxScrollTop = Math.max(
					0,
					target.scrollHeight - target.clientHeight
				);
				switch (e.key) {
					case 'ArrowUp':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = Math.max(
							0,
							target.scrollTop - scrollStep
						);
						return;
					case 'ArrowDown':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = Math.min(
							maxScrollTop,
							target.scrollTop + scrollStep
						);
						return;
					case 'Home':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = 0;
						return;
					case 'End':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = maxScrollTop;
						return;
					default:
						return;
				}
			}

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
			isScrollOnly,
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

		scheduleScrollStateUpdate();
		const onScroll = () => scheduleScrollStateUpdate();
		el.addEventListener('scroll', onScroll, { passive: true });

		const RO = globalThis.ResizeObserver ?? PolyfillResizeObserver;
		const ro = new RO(() => scheduleScrollStateUpdate());
		ro.observe(el);

		return () => {
			el.removeEventListener('scroll', onScroll);
			ro.disconnect();
		};
	}, [scheduleScrollStateUpdate, scrollTargetRef]);

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
			className={['sessionsList__resizeHandle', className]
				.filter(Boolean)
				.join(' ')}
			data-dragging={isDragging ? 'true' : 'false'}
			data-scrollable={isScrollable ? 'true' : 'false'}
			// A separator that can be moved, or a scrollbar - the two modes are
			// genuinely different widgets, so they announce differently rather
			// than sharing one label that is wrong for half the callers.
			role={isScrollOnly ? 'scrollbar' : 'separator'}
			// sonar: both roles are interactive widgets when focusable + keyboard-handled
			tabIndex={0}
			aria-orientation="vertical"
			aria-valuemin={isScrollOnly ? 0 : minWidth}
			aria-valuemax={isScrollOnly ? 100 : maxWidth}
			aria-valuenow={isScrollOnly ? scrollPercent : currentWidth}
			aria-label={
				isScrollOnly
					? t(
							'sessionList.resizeHandle.scrollAriaLabel',
							'Drag to scroll the list.'
						)
					: t(
							'sessionList.resizeHandle.ariaLabel',
							'Resize sessions list. Drag vertically to scroll the sessions list.'
						)
			}
			onDoubleClick={(e) => {
				// Collapsing is a width change, so it belongs to the resize mode.
				if (isScrollOnly) return;
				e.preventDefault();
				e.stopPropagation();
				toggleCollapsed();
			}}
			onWheel={(e) => {
				// UX: a small wheel gesture on the handle should toggle open/close
				// (requested behavior). Keep it gated so it won't trigger on tiny noise.
				if (isDragging || isScrollOnly) return;
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
		>
			<span className="sessionsList__resizeHandlePill" />
		</div>
	);
};
