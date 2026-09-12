/**
 * Resize handle between two panes — Figma "Drag Handle" (1320:38281 →
 * Chat Room Desktop): a 24 px hit zone on one edge of the element it
 * resizes with an 8 × 48 px `primary-fixed-dim` pill vertically centred on
 * the element's full height (T5: never coupled to the list's scrollbar, no
 * chevron button at the list edge any more).
 *
 * Gestures (Frank, *****: "der Dragger muss vertikal zentriert sein, nicht an
 * die Scrollbar attached; drag/halten macht das Einklappen"):
 * - drag horizontally → resize (list: snaps to rail / expanded band);
 * - press and hold (450 ms, still) or double-click → collapse ↔ expand;
 * - keyboard: Left/Right resize, Home/End min/max, Up/Down scroll the list.
 *
 * Deliberately gone with the scrollbar coupling (stage v3 review, P1): the
 * vertical drag-to-scroll, the wheel toggle and the hover auto-focus — all
 * three belonged to the "handle is the list's scrollbar" concept; the wheel
 * toggle hijacked scrolling and the hover focus stole focus from the composer.
 *
 * The one surface that still drags to scroll is `mode="scroll"`
 * (ORISO-Frontend#1196 job 2): the threads dropdown is fixed at
 * min(360px, 100% - 32px), so it has no width to give and the handle is
 * purely a scroll grip there. That mode never resizes and never collapses.
 *
 * Used by the session list column (`anchor="end"`, list snapping), by the
 * chat's side panel (`anchor="start"`, T2) and by the threads dropdown
 * (`mode="scroll"`). Math in `resizableHandleMath.ts`.
 */
import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import {
	clampWidth,
	getToggledSidebarWidth,
	HOLD_TO_COLLAPSE_MS,
	isHoldGesture,
	snapSessionsListWidth,
	widthFromPointer,
	type ResizeAnchor
} from './resizableHandleMath';

export { getToggledSidebarWidth } from './resizableHandleMath';

export type ResizableHandleMode = 'resizeAndScroll' | 'scroll';

interface ResizableHandleCommonProps {
	/** Keyboard Up/Down (and, in scroll mode, the drag) move this container. */
	'scrollTargetRef'?: React.RefObject<HTMLDivElement | null>;
	'minWidth'?: number;
	'maxWidth'?: number;
	'ariaLabel'?: string;
	/** Extra class for placement; the base class carries the behaviour styles. */
	'className'?: string;
	'data-cy'?: string;
}

/**
 * The default: drag sideways to resize, press and hold to collapse.
 * `onResize` and `currentWidth` are required, because collapsing and the
 * ArrowLeft/ArrowRight/Home/End keys all call `onResize` with no guard.
 */
interface ResizeHandleProps extends ResizableHandleCommonProps {
	mode?: 'resizeAndScroll';
	onResize: (width: number) => void;
	currentWidth: number;
	/** Which edge of the resized element the handle sits on (default: end). */
	anchor?: ResizeAnchor;
	/** Session-list snapping (icon rail ↔ expanded band). Off for panels. */
	snapping?: boolean;
}

/**
 * Scroll only, for surfaces that scroll but have no width of their own to give
 * — the threads dropdown is fixed at min(360px, 100% - 32px), so a resize drag
 * there would have nothing to act on (ORISO-Frontend#1196 job 2).
 */
interface ScrollOnlyHandleProps extends ResizableHandleCommonProps {
	mode: 'scroll';
	onResize?: never;
	currentWidth?: never;
	anchor?: never;
	snapping?: never;
}

/*
 * A union rather than two optional props. `tsconfig.json` sets
 * "strictNullChecks": false, so plain optional props let
 * `<ResizableHandle scrollTargetRef={ref} />` type-check and then throw on the
 * first ArrowLeft or double-click — the resize paths call `onResize`
 * unguarded. Discriminating on `mode` restores the guarantee the required
 * props used to give, and makes passing a resize callback to a scroll-only
 * handle a type error rather than something silently ignored.
 */
export type ResizableHandleProps = ResizeHandleProps | ScrollOnlyHandleProps;

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	mode = 'resizeAndScroll',
	onResize,
	currentWidth = 0,
	scrollTargetRef,
	minWidth = 80,
	maxWidth = 600,
	anchor = 'end',
	snapping = true,
	ariaLabel,
	className,
	'data-cy': dataCy = 'resizable-handle'
}) => {
	const isScrollOnly = mode === 'scroll';
	const { t } = useTranslation();
	const { EXPANDED_MIN_WIDTH } = SESSIONS_LIST_RESIZE;
	const [isDragging, setIsDragging] = useState(false);
	const handleRef = useRef<HTMLDivElement | null>(null);
	const pointerIdRef = useRef<number | null>(null);
	// Press-and-hold: where the press started, how far it moved, the timer.
	const pressStartRef = useRef<{
		x: number;
		y: number;
		scrollTop: number;
	} | null>(null);
	const movedPxRef = useRef(0);
	const holdTimerRef = useRef<number | null>(null);
	const clearHoldTimer = useCallback(() => {
		if (holdTimerRef.current !== null) {
			window.clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}
	}, []);

	// Scroll mode announces itself as a scrollbar, so it needs a value.
	const [scrollPercent, setScrollPercent] = useState(0);
	const updateScrollPercent = useCallback(() => {
		const el = scrollTargetRef?.current;
		if (!el) return;
		const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
		setScrollPercent(
			maxScrollTop <= 0
				? 0
				: Math.round((el.scrollTop / maxScrollTop) * 100)
		);
	}, [scrollTargetRef]);

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
			onResize?.(
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

	const toggleCollapsed = useCallback(() => {
		onResize?.(
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

	// The hold timer fires later than the render it was armed in.
	const toggleCollapsedRef = useRef(toggleCollapsed);
	toggleCollapsedRef.current = toggleCollapsed;

	const handlePointerUp = useCallback(() => {
		clearHoldTimer();
		pointerIdRef.current = null;
		pressStartRef.current = null;
		setIsDragging(false);
	}, [clearHoldTimer]);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			pointerIdRef.current = e.pointerId;
			pressStartRef.current = {
				x: e.clientX,
				y: e.clientY,
				scrollTop: scrollTargetRef?.current?.scrollTop ?? 0
			};
			movedPxRef.current = 0;
			setIsDragging(true);
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {
				// Synthetic pointers (tests) have no capture; the document
				// listeners below still see the move/up.
			}
			// Hold still → collapse / expand (T5). A drag cancels the timer.
			// Scroll-only surfaces have no collapsed state, so no timer.
			if (isScrollOnly) return;
			clearHoldTimer();
			holdTimerRef.current = window.setTimeout(() => {
				holdTimerRef.current = null;
				if (isHoldGesture({ movedPx: movedPxRef.current })) {
					toggleCollapsedRef.current();
					handlePointerUp();
				}
			}, HOLD_TO_COLLAPSE_MS);
		},
		[clearHoldTimer, handlePointerUp, isScrollOnly, scrollTargetRef]
	);

	const handlePointerMove = useCallback(
		(e: PointerEvent) => {
			if (!isDragging) return;
			if (
				pointerIdRef.current !== null &&
				e.pointerId !== pointerIdRef.current
			) {
				return;
			}
			const start = pressStartRef.current;

			// Scroll mode: the drag is the scroll gesture, nothing resizes.
			if (isScrollOnly) {
				const target = scrollTargetRef?.current;
				if (!target || !start) return;
				const maxScrollTop = Math.max(
					0,
					target.scrollHeight - target.clientHeight
				);
				target.scrollTop = Math.min(
					maxScrollTop,
					Math.max(0, start.scrollTop + (e.clientY - start.y))
				);
				updateScrollPercent();
				return;
			}

			if (start) {
				movedPxRef.current = Math.max(
					movedPxRef.current,
					Math.hypot(e.clientX - start.x, e.clientY - start.y)
				);
				if (!isHoldGesture({ movedPx: movedPxRef.current })) {
					clearHoldTimer();
				}
			}
			applyClientXToWidth(e.clientX);
		},
		[
			applyClientXToWidth,
			clearHoldTimer,
			isDragging,
			isScrollOnly,
			scrollTargetRef,
			updateScrollPercent
		]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const resizeStep = e.shiftKey ? 40 : 20;
			const scrollStep = e.shiftKey ? 240 : 120;
			// With the handle on the start edge, "left" makes the pane wider.
			const direction = anchor === 'start' ? -1 : 1;

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
						updateScrollPercent();
						return;
					case 'ArrowDown':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = Math.min(
							maxScrollTop,
							target.scrollTop + scrollStep
						);
						updateScrollPercent();
						return;
					case 'Home':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = 0;
						updateScrollPercent();
						return;
					case 'End':
						e.stopPropagation();
						e.preventDefault();
						target.scrollTop = maxScrollTop;
						updateScrollPercent();
						return;
					default:
						return;
				}
			}

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
			isScrollOnly,
			maxWidth,
			minWidth,
			normalizeWidth,
			onResize,
			scrollTargetRef,
			updateScrollPercent
		]
	);

	useEffect(() => {
		const el = scrollTargetRef?.current;
		if (!el || !isScrollOnly) {
			return undefined;
		}
		updateScrollPercent();
		el.addEventListener('scroll', updateScrollPercent, { passive: true });
		return () => el.removeEventListener('scroll', updateScrollPercent);
	}, [isScrollOnly, scrollTargetRef, updateScrollPercent]);

	useEffect(() => {
		if (!isDragging) {
			return undefined;
		}
		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
		document.addEventListener('pointercancel', handlePointerUp);
		document.body.style.cursor = isScrollOnly ? 'grabbing' : 'col-resize';
		document.body.style.userSelect = 'none';
		return () => {
			document.removeEventListener('pointermove', handlePointerMove);
			document.removeEventListener('pointerup', handlePointerUp);
			document.removeEventListener('pointercancel', handlePointerUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, [isDragging, isScrollOnly, handlePointerMove, handlePointerUp]);

	useEffect(
		() => () => {
			// Safety net: never leak body styles or a hold timer on unmount.
			clearHoldTimer();
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		},
		[clearHoldTimer]
	);

	return (
		<div
			ref={handleRef}
			className={[
				'sessionsList__resizeHandle',
				!isScrollOnly && `sessionsList__resizeHandle--${anchor}`,
				className
			]
				.filter(Boolean)
				.join(' ')}
			data-dragging={isDragging ? 'true' : 'false'}
			data-cy={dataCy}
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
				ariaLabel ??
				(isScrollOnly
					? t(
							'sessionList.resizeHandle.scrollAriaLabel',
							'Drag to scroll the list.'
						)
					: t(
							'sessionList.resizeHandle.ariaLabel',
							'Resize the sessions list: drag to resize, hold or double-click to collapse or expand, Up and Down scroll the list.'
						))
			}
			onDoubleClick={(e) => {
				// Collapsing is a width change, so it belongs to the resize mode.
				if (isScrollOnly) return;
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
