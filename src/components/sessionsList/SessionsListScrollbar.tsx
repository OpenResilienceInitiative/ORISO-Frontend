import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

type ScrollbarMetrics = {
	trackHeight: number;
	thumbHeight: number;
	thumbTop: number;
	canScroll: boolean;
};

const MIN_THUMB_PX = 28;
const TRACK_PADDING_PX = 4;

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function computeMetrics(el: HTMLElement | null): ScrollbarMetrics {
	if (!el) {
		return {
			trackHeight: 0,
			thumbHeight: 0,
			thumbTop: 0,
			canScroll: false
		};
	}

	const view = el.clientHeight;
	const content = el.scrollHeight;
	const maxScrollTop = Math.max(0, content - view);
	const canScroll = maxScrollTop > 0 && view > 0;

	const trackHeight = Math.max(0, view - TRACK_PADDING_PX * 2);
	if (!canScroll || trackHeight <= 0) {
		return { trackHeight, thumbHeight: 0, thumbTop: 0, canScroll: false };
	}

	const idealThumb = (view / content) * trackHeight;
	const thumbHeight = clamp(idealThumb, MIN_THUMB_PX, trackHeight);

	const scrollProgress = maxScrollTop === 0 ? 0 : el.scrollTop / maxScrollTop;
	const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
	const thumbTop = scrollProgress * maxThumbTop;

	return { trackHeight, thumbHeight, thumbTop, canScroll: true };
}

export function SessionsListScrollbar({
	scrollRef
}: Readonly<{
	scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
	const [metrics, setMetrics] = useState<ScrollbarMetrics>(() =>
		computeMetrics(scrollRef.current)
	);
	const [isVisible, setIsVisible] = useState(false);
	const isDraggingRef = useRef(false);
	const isHoveringRef = useRef(false);
	const dragStartRef = useRef<{ pointerY: number; scrollTop: number } | null>(
		null
	);
	const dragPointerIdRef = useRef<number | null>(null);
	const rafIdRef = useRef<number | null>(null);
	const hideTimeoutRef = useRef<number | null>(null);

	const scheduleUpdate = useCallback(() => {
		if (rafIdRef.current !== null) return;
		rafIdRef.current = globalThis.requestAnimationFrame(() => {
			rafIdRef.current = null;
			setMetrics(computeMetrics(scrollRef.current));
		});
	}, [scrollRef]);

	const showTemporarily = useCallback((ms: number) => {
		setIsVisible(true);
		if (hideTimeoutRef.current) {
			globalThis.clearTimeout(hideTimeoutRef.current);
		}
		hideTimeoutRef.current = globalThis.setTimeout(() => {
			if (isDraggingRef.current) return;
			if (isHoveringRef.current) return;
			setIsVisible(false);
		}, ms) as unknown as number;
	}, []);

	useLayoutEffect(() => {
		scheduleUpdate();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const onScroll = () => {
			scheduleUpdate();
			showTemporarily(900);
		};
		el.addEventListener('scroll', onScroll, { passive: true });

		const ro = new ResizeObserver(() => scheduleUpdate());
		ro.observe(el);

		const EDGE_PX = 22;
		const onPointerMove = (e: PointerEvent) => {
			// If content doesn't overflow, don't hijack hover UX.
			const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
			if (maxScrollTop <= 0) return;

			const rect = el.getBoundingClientRect();
			const nearRightEdge = e.clientX >= rect.right - EDGE_PX;
			const insideVertically =
				e.clientY >= rect.top && e.clientY <= rect.bottom;

			if (nearRightEdge && insideVertically) {
				showTemporarily(1200);
			}
		};

		el.addEventListener('pointermove', onPointerMove, { passive: true });

		return () => {
			el.removeEventListener('scroll', onScroll);
			el.removeEventListener('pointermove', onPointerMove);
			ro.disconnect();
		};
	}, [scheduleUpdate, scrollRef, showTemporarily]);

	useEffect(() => {
		if (!metrics.canScroll) return;
		// First paint hint: makes the pill discoverable without scrolling first.
		showTemporarily(900);
	}, [metrics.canScroll, showTemporarily]);

	useEffect(() => {
		return () => {
			if (rafIdRef.current !== null) {
				globalThis.cancelAnimationFrame(rafIdRef.current);
			}
			if (hideTimeoutRef.current) {
				globalThis.clearTimeout(hideTimeoutRef.current);
			}
		};
	}, []);

	const handleThumbPointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			const el = scrollRef.current;
			if (!el) return;
			if (!metrics.canScroll) return;
			if (e.button !== 0) return;

			e.preventDefault();
			e.stopPropagation();

			setIsVisible(true);
			isDraggingRef.current = true;
			dragPointerIdRef.current = e.pointerId;
			dragStartRef.current = {
				pointerY: e.clientY,
				scrollTop: el.scrollTop
			};
			e.currentTarget.setPointerCapture(e.pointerId);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'grabbing';
		},
		[metrics.canScroll, scrollRef]
	);

	const endDrag = useCallback(() => {
		if (!isDraggingRef.current) return;
		isDraggingRef.current = false;
		dragStartRef.current = null;
		dragPointerIdRef.current = null;
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		showTemporarily(700);
	}, [showTemporarily]);

	const handleThumbPointerMove = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			if (!isDraggingRef.current) return;
			if (
				dragPointerIdRef.current !== null &&
				e.pointerId !== dragPointerIdRef.current
			) {
				return;
			}
			const el = scrollRef.current;
			const start = dragStartRef.current;
			if (!el || !start) return;

			const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
			const trackHeight = metrics.trackHeight;
			const thumbHeight = metrics.thumbHeight;
			const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
			const deltaY = e.clientY - start.pointerY;
			const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
			el.scrollTop = clamp(
				start.scrollTop + scrollDelta,
				0,
				maxScrollTop
			);
		},
		[metrics.thumbHeight, metrics.trackHeight, scrollRef]
	);

	const handleThumbPointerUp = useCallback(() => {
		endDrag();
	}, [endDrag]);

	if (!metrics.canScroll) return null;

	return (
		<div
			className="sessionsList__customScrollbar"
			data-visible={isVisible ? 'true' : 'false'}
			aria-hidden="true"
			onMouseEnter={() => {
				isHoveringRef.current = true;
				setIsVisible(true);
			}}
			onMouseLeave={() => {
				isHoveringRef.current = false;
				showTemporarily(400);
			}}
		>
			<button
				type="button"
				className="sessionsList__customScrollbarThumb"
				onPointerDown={handleThumbPointerDown}
				onPointerMove={handleThumbPointerMove}
				onPointerUp={handleThumbPointerUp}
				onPointerCancel={handleThumbPointerUp}
				style={{
					height: `${metrics.thumbHeight}px`,
					transform: `translateY(${TRACK_PADDING_PX + metrics.thumbTop}px)`
				}}
			/>
		</div>
	);
}
