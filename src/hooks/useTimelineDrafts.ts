import { useMemo } from 'react';
import type { NotificationFeedItem } from '../globalState/provider/NotificationsProvider';
import { draftsToFeedItems } from '../components/notificationsCenter/timelineDrafts';
import { useRemoteDrafts } from './useRemoteDrafts';

/** The user's unsent drafts as timeline cards, kept fresh like the sessions list. */
export const useTimelineDrafts = (): NotificationFeedItem[] => {
	const drafts = useRemoteDrafts();
	return useMemo(() => draftsToFeedItems(drafts), [drafts]);
};
