import { useEffect, useState } from 'react';
import { apiGetUserDrafts } from '../api/apiUserDrafts';
import type { NotificationFeedItem } from '../globalState/provider/NotificationsProvider';
import {
	DRAFTS_UPDATED_EVENT,
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../services/draftStore';

/** A personal action trail, derived from the existing drafts. No copied content. */
export const useTimelineDrafts = (): NotificationFeedItem[] => {
	const [drafts, setDrafts] = useState<NotificationFeedItem[]>([]);
	useEffect(() => {
		let active = true;
		let request = 0;
		const refresh = async () => {
			const currentRequest = ++request;
			const response = await apiGetUserDrafts(0, 200);
			if (!active || currentRequest !== request) return;
			setDrafts(
				(response?.items || [])
					.filter(
						(draft) =>
							draft.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE &&
							hasDraftContent(draft.text)
					)
					.map((draft) => {
						const [base, query = ''] = (
							draft.actionPath || '/drafts'
						).split('?');
						const params = new URLSearchParams(query);
						params.delete('embeddedNotifications');
						params.set('draftScopeKey', draft.scopeKey);
						return {
							id: `local-draft-${draft.scopeKey}`,
							type: 'info',
							eventType: 'draft.created',
							category: 'system',
							title: '',
							text: '',
							createdAt:
								draft.updatedAt || new Date(0).toISOString(),
							readAt:
								draft.updatedAt || new Date(0).toISOString(),
							sourceSessionId:
								draft.sourceSessionId == null
									? undefined
									: String(draft.sourceSessionId),
							actionPath: `${base}?${params}`,
							params: {
								forcedScopeKey: draft.scopeKey,
								roomRef: draft.roomRef
							}
						};
					})
			);
		};
		const onRefresh = () => {
			void refresh();
		};
		onRefresh();
		window.addEventListener(DRAFTS_UPDATED_EVENT, onRefresh);
		const interval = window.setInterval(onRefresh, 60000);
		return () => {
			active = false;
			window.clearInterval(interval);
			window.removeEventListener(DRAFTS_UPDATED_EVENT, onRefresh);
		};
	}, []);
	return drafts;
};
