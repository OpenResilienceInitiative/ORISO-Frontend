/**
 * #1824: unsent preview text per conversation (room + thread). Memory only:
 * never persisted or server-visible, independent of the Timeline page, and
 * emptied on sign-out (`teardownLocalSession`) so nothing user-scoped outlives
 * the session (#1071). The chat's own draft store stays tied to its composer.
 */
const drafts = new Map<string, string>();

const key = (roomId: string, threadRootId?: string | null) =>
	`${roomId}|${threadRootId || 'main'}`;

export const getPreviewDraft = (
	roomId: string | null,
	threadRootId?: string | null
): string => (roomId ? drafts.get(key(roomId, threadRootId)) || '' : '');

export const setPreviewDraft = (
	roomId: string,
	threadRootId: string | null | undefined,
	text: string
) => {
	if (text) {
		drafts.set(key(roomId, threadRootId), text);
	} else {
		drafts.delete(key(roomId, threadRootId));
	}
};

export const clearPreviewDrafts = () => drafts.clear();
