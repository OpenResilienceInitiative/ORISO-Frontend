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
	oldestId?: string;
	top: number;
	height: number;
	completed: boolean;
	hasMore: boolean;
}

const oldestRenderedId = (container: HTMLElement) =>
	container.querySelector<HTMLElement>('[data-message-id]')?.dataset
		.messageId;

const captureReadingPosition = (container: HTMLElement) => {
	const visibleTop = container.getBoundingClientRect().top;
	const anchor = Array.from(
		container.querySelectorAll<HTMLElement>('[data-message-id]')
	).find((message) => message.getBoundingClientRect().bottom > visibleTop);
	return {
		anchorId: anchor?.dataset.messageId,
		oldestId: oldestRenderedId(container),
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
		page.stopTracking();
		if (!container || container !== page.container) {
			pending.current = null;
			busy.current = false;
			return; // A replacement card owns its own reading position.
		}
		const anchor = Array.from(
			container.querySelectorAll<HTMLElement>('[data-message-id]')
		).find((message) => message.dataset.messageId === page.anchorId);
		if (anchor && page.anchorTop !== undefined) {
			container.scrollTop +=
				anchor.getBoundingClientRect().top - page.anchorTop;
		} else {
			container.scrollTop =
				page.top + container.scrollHeight - page.height;
		}
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
		const page: PendingPage = {
			container,
			stopTracking: () =>
				container.removeEventListener('scroll', trackNavigation),
			generation: generation.current,
			...captureReadingPosition(container),
			completed: false,
			hasMore: false
		};
		const trackNavigation = () => {
			if (
				pending.current !== page ||
				oldestRenderedId(container) !== page.oldestId
			)
				return;
			// Rebase while the older page is not rendered yet. A scroll caused by
			// native anchoring after prepend must not replace this chosen position.
			// Not keyed on height: a composer resize changes it before the page lands.
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
