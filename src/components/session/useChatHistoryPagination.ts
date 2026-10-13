import {
	RefObject,
	useCallback,
	useLayoutEffect,
	useRef,
	useState
} from 'react';

interface PendingPage {
	generation: number;
	anchorId?: string;
	anchorTop?: number;
	top: number;
	height: number;
	completed: boolean;
	hasMore: boolean;
}

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
		pending.current = null;
		return () => {
			generation.current += 1;
		};
	}, [sessionId, loadEarlier]);

	useLayoutEffect(() => {
		const page = pending.current;
		const container = timeline.current;
		if (
			!page?.completed ||
			!container ||
			page.generation !== generation.current
		)
			return;
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
		const visibleTop = container.getBoundingClientRect().top;
		const anchor = Array.from(
			container.querySelectorAll<HTMLElement>('[data-message-id]')
		).find(
			(message) => message.getBoundingClientRect().bottom > visibleTop
		);
		const page: PendingPage = {
			generation: generation.current,
			anchorId: anchor?.dataset.messageId,
			anchorTop: anchor?.getBoundingClientRect().top,
			top: container.scrollTop,
			height: container.scrollHeight,
			completed: false,
			hasMore: false
		};
		pending.current = page;
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
