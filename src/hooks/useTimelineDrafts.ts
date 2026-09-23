import { useEffect, useState } from 'react';
import { apiGetUserDrafts } from '../api/apiUserDrafts';
import type { NotificationFeedItem } from '../globalState/provider/NotificationsProvider';
import { draftsToFeedItems } from '../components/notificationsCenter/timelineDrafts';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';

const REFRESH_INTERVAL_MS = 60000;

/** The user's unsent drafts as timeline cards, kept fresh like the sessions list. */
export const useTimelineDrafts = (): NotificationFeedItem[] => {
	const [drafts, setDrafts] = useState<NotificationFeedItem[]>([]);
	useEffect(() => {
		let active = true;
		let latestRequest = 0;
		const refresh = async () => {
			const request = ++latestRequest;
			const response = await apiGetUserDrafts(0, 200);
			// A slower earlier response must not overwrite a newer one.
			if (!active || request !== latestRequest) return;
			setDrafts(draftsToFeedItems(response?.items || []));
		};
		const onRefresh = () => {
			void refresh();
		};
		onRefresh();
		window.addEventListener(DRAFTS_UPDATED_EVENT, onRefresh);
		const interval = window.setInterval(onRefresh, REFRESH_INTERVAL_MS);
		return () => {
			active = false;
			window.clearInterval(interval);
			window.removeEventListener(DRAFTS_UPDATED_EVENT, onRefresh);
		};
	}, []);
	return drafts;
};
