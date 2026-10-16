import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'oriso.dismissedNotice.';
/** Memory marker for a notice that has no stable id to remember it by. */
const ANONYMOUS_NOTICE = '\u0000';

const readStored = (key: string): boolean => {
	try {
		return window.localStorage.getItem(STORAGE_PREFIX + key) === '1';
	} catch {
		// Private window / blocked site data: behave as "never dismissed".
		return false;
	}
};

const writeStored = (key: string) => {
	try {
		window.localStorage.setItem(STORAGE_PREFIX + key, '1');
	} catch {
		// Not remembering is fine; the notice is still hidden for this view.
	}
};

/**
 * Lets a person close an in-chat notice (ORISO-Frontend#1700).
 *
 * Dismissing only hides the notice. It is never an answer to anything the
 * notice asks, so the caller decides whether the dismissal may outlive this
 * view: pass `persist: true` only when nothing is left to act on (information
 * only, or a request that is already settled). A notice that still waits for a
 * decision is hidden for this view only and returns on the next load, so a
 * pending request can never be lost by closing it.
 *
 * @param noticeId Stable id of the notice (e.g. the notification id). Without
 *   one the dismissal lasts for this mounted view only.
 */
export const useDismissibleNotice = (
	noticeId: string | undefined,
	{ persist }: { persist: boolean }
) => {
	const memoryKey = noticeId ?? ANONYMOUS_NOTICE;
	const [dismissedInView, setDismissedInView] = useState<string | null>(null);

	const dismiss = useCallback(() => {
		if (persist && noticeId) {
			writeStored(noticeId);
		}
		setDismissedInView(memoryKey);
	}, [memoryKey, noticeId, persist]);

	const dismissed =
		dismissedInView === memoryKey ||
		(persist && !!noticeId && readStored(noticeId));

	return { dismissed, dismiss };
};
