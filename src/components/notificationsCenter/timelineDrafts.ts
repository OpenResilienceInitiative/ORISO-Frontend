import type { IUserDraftItem } from '../../api/apiUserDrafts';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import {
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../../services/draftStore';

/**
 * Unsent drafts as timeline cards (#1535). They live only in the client
 * list — never in the provider feed — so they cannot ring, pop up, count as
 * unread or be sent to the server as a read receipt.
 */
const DRAFT_ID_PREFIX = 'local-draft-';

export const isTimelineDraftId = (id: string): boolean =>
	id.startsWith(DRAFT_ID_PREFIX);

const splitWithoutEmbedded = (path: string) => {
	const [base, query = ''] = path.split('?');
	const params = new URLSearchParams(query);
	params.delete('embeddedNotifications');
	return { base, params };
};

/** The path as a full-page route, without the timeline's embedded flag. */
export const toNonEmbeddedPath = (path?: string | null): string | null => {
	if (!path) {
		return null;
	}
	const { base, params } = splitWithoutEmbedded(String(path));
	const query = params.toString();
	return `${base}${query ? `?${query}` : ''}`;
};

const resumePath = (draft: IUserDraftItem): string => {
	const { base, params } = splitWithoutEmbedded(
		draft.actionPath || '/drafts'
	);
	params.set('draftScopeKey', draft.scopeKey);
	return `${base}?${params}`;
};

// Metadata only: the draft text (ciphertext in E2EE rooms) and the contact
// title stay out of the card, which renders from the i18n template.
export const draftsToFeedItems = (
	drafts: IUserDraftItem[]
): NotificationFeedItem[] =>
	drafts
		.filter(
			(draft) =>
				draft.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE &&
				hasDraftContent(draft.text)
		)
		.map((draft) => {
			const at = draft.updatedAt || new Date(0).toISOString();
			return {
				id: `${DRAFT_ID_PREFIX}${draft.scopeKey}`,
				type: 'info',
				eventType: 'draft.created',
				category: 'system',
				title: '',
				text: '',
				createdAt: at,
				readAt: at,
				sourceSessionId:
					draft.sourceSessionId == null
						? undefined
						: String(draft.sourceSessionId),
				actionPath: resumePath(draft),
				params: {
					forcedScopeKey: draft.scopeKey,
					roomRef: draft.roomRef ?? null
				}
			};
		});

export const mergeDraftsIntoFeed = (
	feed: NotificationFeedItem[],
	drafts: NotificationFeedItem[]
): NotificationFeedItem[] =>
	drafts.length === 0
		? feed
		: [...feed, ...drafts].sort(
				(left, right) =>
					new Date(right.createdAt).getTime() -
					new Date(left.createdAt).getTime()
			);
