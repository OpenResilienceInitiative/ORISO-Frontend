import { useCallback, useEffect, useRef, useState } from 'react';
import { chatTransportService } from '../../services/chatTransportService';

export const PREVIEW_PAGE_SIZE = 50;

export type PreviewHistoryStatus = 'more' | 'loading' | 'error' | 'end';

const statusFor = (roomId: string | null, limit: number) => {
	if (!roomId) return 'end';
	const { cachedCount, hasMoreOnServer } =
		chatTransportService.getMatrixRoomHistoryState(roomId);
	return cachedCount > limit || hasMoreOnServer ? 'more' : 'end';
};

/**
 * #929: controlled backward paging for the read-only conversation preview.
 *
 * The preview shows the newest `limit` events of the room's live timeline.
 * `loadOlder` widens that window by one bounded page: from the client's cache
 * when it already holds older events, otherwise through the chat's own SDK
 * paging call (`loadEarlierMatrixRoomMessages` → `client.scrollback`).
 *
 * The main chat's `useChatHistoryPagination` is scroll-triggered, loads on
 * its own when the list is underfilled and swallows errors, so it cannot back
 * an explicit control with loading, error and end states. Neither path
 * registers an active view, sends a receipt or sets a read marker.
 *
 * `onBeforeGrow` runs right before the window grows, so the caller can
 * capture its scroll position for anchoring.
 */
export const usePreviewHistoryPaging = (
	roomId: string | null,
	onBeforeGrow: () => void
) => {
	const [limit, setLimit] = useState(PREVIEW_PAGE_SIZE);
	const [status, setStatus] = useState<PreviewHistoryStatus>(() =>
		statusFor(roomId, PREVIEW_PAGE_SIZE)
	);
	const busy = useRef(false);
	const scope = useRef(0);
	const limitRef = useRef(limit);
	limitRef.current = limit;
	const onBeforeGrowRef = useRef(onBeforeGrow);
	onBeforeGrowRef.current = onBeforeGrow;

	useEffect(() => {
		scope.current += 1;
		busy.current = false;
		setLimit(PREVIEW_PAGE_SIZE);
		setStatus(statusFor(roomId, PREVIEW_PAGE_SIZE));
	}, [roomId]);

	/** Re-read the end-of-history state, e.g. after the room synced. */
	const refreshStatus = useCallback(() => {
		if (!busy.current) {
			setStatus((current) =>
				current === 'error'
					? current
					: statusFor(roomId, limitRef.current)
			);
		}
	}, [roomId]);

	const loadOlder = useCallback(async () => {
		if (!roomId || busy.current) return;
		const requestScope = scope.current;
		const nextLimit = limitRef.current + PREVIEW_PAGE_SIZE;
		const grow = () => {
			onBeforeGrowRef.current();
			limitRef.current = nextLimit;
			setLimit(nextLimit);
			setStatus(statusFor(roomId, nextLimit));
		};
		const { cachedCount } =
			chatTransportService.getMatrixRoomHistoryState(roomId);
		// Older events already in the client: show them without a request.
		if (cachedCount > limitRef.current) {
			grow();
			return;
		}
		busy.current = true;
		setStatus('loading');
		try {
			await chatTransportService.loadEarlierMatrixRoomMessages(roomId);
			if (scope.current !== requestScope) return;
			busy.current = false;
			grow();
		} catch {
			if (scope.current !== requestScope) return;
			busy.current = false;
			setStatus('error');
		}
	}, [roomId]);

	return { limit, status, loadOlder, refreshStatus };
};
