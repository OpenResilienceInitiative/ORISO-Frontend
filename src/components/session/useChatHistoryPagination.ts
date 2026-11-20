import {
	RefObject,
	useCallback,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

interface PendingPage {
	container: HTMLElement;
	stopTracking: () => void;
	generation: number;
	anchorId?: string;
	anchorTop?: number;
	top: number;
	height: number;
	completed: boolean;
	hasMore: boolean;
}

const captureReadingPosition = (container: HTMLElement) => {
	const visibleTop = container.getBoundingClientRect().top;
	const anchor = Array.from(
		container.querySelectorAll<HTMLElement>('[data-message-id]')
	).find((message) => message.getBoundingClientRect().bottom > visibleTop);
	return {
		anchorId: anchor?.dataset.messageId,
		anchorTop: anchor?.getBoundingClientRect().top,
		top: container.scrollTop,
		height: container.scrollHeight
	};
};

/** Keep the visible message anchored after React commits an older SDK page. */
export const useChatHistoryPagination = (
	timeline: RefObject<HTMLElement>,
	sessionId: number,
	messageCount: number | undefined,
	loadEarlier?: () => Promise<boolean>
) => {
	const busy = useRef(false);
	const exhausted = useRef(false);
	const generation = useRef(0);
	const pending = useRef<PendingPage | null>(null);
	const loadAtStartRef = useRef<() => void>(() => {});
	const [completedPage, setCompletedPage] = useState(0);
	useLayoutEffect(() => {
		generation.current += 1;
		busy.current = false;
		exhausted.current = false;
		pending.current?.stopTracking();
		pending.current = null;
		return () => {
			pending.current?.stopTracking();
			generation.current += 1;
		};
	}, [sessionId, loadEarlier]);

	useLayoutEffect(() => {
		const page = pending.current;
		const container = timeline.current;
		if (!page?.completed || page.generation !== generation.current) return;
		if (!container || container !== page.container) {
			page.stopTracking();
			pending.current = null;
			busy.current = false;
			return; // A replacement card owns its own reading position.
		}
		const anchor = Array.from(
			container.querySelectorAll<HTMLElement>('[data-message-id]')
		).find((message) => message.dataset.messageId === page.anchorId);
		// Geometry changes before the browser delivers its scroll event. With
		// native anchoring paused, this delta is navigation since the last sample,
		// even when the event is still queued when React prepends the page.
		const navigationDelta = container.scrollTop - page.top;
		if (anchor && page.anchorTop !== undefined) {
			container.scrollTop +=
				anchor.getBoundingClientRect().top -
				(page.anchorTop - navigationDelta);
		} else {
			container.scrollTop =
				container.scrollTop + container.scrollHeight - page.height;
		}
		page.stopTracking();
		pending.current = null;
		busy.current = false;
		// Metadata-only pages may add no visible height. Keep going until
		// a message or the start of history makes further scrolling possible.
		if (page.hasMore && container.scrollTop <= 48) {
			queueMicrotask(() => loadAtStartRef.current());
		}
	}, [messageCount, completedPage, timeline]);

	const loadAtStart = useCallback(() => {
		const container = timeline.current;
		if (
			!container ||
			!loadEarlier ||
			busy.current ||
			exhausted.current ||
			container.scrollTop > 48
		)
			return;
		const previousAnchoring =
			container.style.getPropertyValue('overflow-anchor');
		const previousPriority =
			container.style.getPropertyPriority('overflow-anchor');
		// Let this hook own prepend correction. Otherwise browser anchoring and
		// user navigation both change scrollTop and cannot be distinguished.
		container.style.setProperty('overflow-anchor', 'none');
		let tracking = true;
		const page: PendingPage = {
			container,
			stopTracking: () => {
				if (!tracking) return;
				tracking = false;
				container.removeEventListener('scroll', trackNavigation);
				if (previousAnchoring) {
					container.style.setProperty(
						'overflow-anchor',
						previousAnchoring,
						previousPriority
					);
				} else {
					container.style.removeProperty('overflow-anchor');
				}
			},
			generation: generation.current,
			...captureReadingPosition(container),
			completed: false,
			hasMore: false
		};
		const trackNavigation = () => {
			if (
				pending.current !== page ||
				container.scrollHeight !== page.height
			)
				return;
			// Rebase while the original DOM is still present. A scroll caused by
			// native anchoring after prepend must not replace this chosen position.
			Object.assign(page, captureReadingPosition(container));
		};
		pending.current = page;
		container.addEventListener('scroll', trackNavigation);
		busy.current = true;
		void loadEarlier()
			.then((hasMore) => {
				if (generation.current !== page.generation) return;
				exhausted.current = !hasMore;
				page.hasMore = hasMore;
				page.completed = true;
				setCompletedPage((count) => count + 1);
			})
			.catch(() => {
				page.stopTracking();
				// Retain loaded history and allow the next normal scroll to retry.
				if (generation.current === page.generation) {
					pending.current = null;
					busy.current = false;
				}
			});
	}, [timeline, loadEarlier]);
	loadAtStartRef.current = loadAtStart;
	useLayoutEffect(() => {
		const container = timeline.current;
		// A resolved empty/underfilled window cannot produce a top-scroll.
		// The SDK may have older messages behind recent room metadata.
		if (
			messageCount !== undefined &&
			container &&
			(messageCount === 0 ||
				container.scrollHeight <= container.clientHeight)
		) {
			queueMicrotask(() => loadAtStartRef.current());
		}
	}, [messageCount, loadEarlier, timeline]);
	return loadAtStart;
};
