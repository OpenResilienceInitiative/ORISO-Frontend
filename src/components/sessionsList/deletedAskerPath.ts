/**
 * Where a counsellor opens the notice for a deleted advice-seeker chat. The
 * session itself is gone; the id it had is all that is left.
 */
export const DELETED_ASKER_BASE_PATH =
	'/sessions/consultant/sessionView/deleted';
export const DELETED_ASKER_ROUTE = `${DELETED_ASKER_BASE_PATH}/:formerSessionId`;

export const deletedAskerPath = (formerSessionId: number | string): string =>
	`${DELETED_ASKER_BASE_PATH}/${formerSessionId}`;

/** Only a positive integer from the address bar is a former session id. */
export const parseFormerSessionId = (value: unknown): number | null => {
	const text = String(value ?? '');
	if (!/^[1-9]\d*$/.test(text)) return null;
	const id = Number(text);
	return Number.isSafeInteger(id) ? id : null;
};

/** Fired on window after a placeholder moved into the archive. */
export const DELETED_ASKER_ARCHIVED_EVENT = 'oriso:deleted-asker-archived';

export const announceDeletedAskerArchived = (formerSessionId: number) => {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent(DELETED_ASKER_ARCHIVED_EVENT, {
			detail: { formerSessionId }
		})
	);
};
