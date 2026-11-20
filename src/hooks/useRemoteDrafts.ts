import { useEffect, useState } from 'react';
import { apiFetchUserDrafts, type IUserDraftItem } from '../api/apiUserDrafts';
import {
	getDraftAuthSessionIdentity,
	subscribeDraftCryptographyForWindow
} from '../services/draftCryptographyWindow';
import {
	DRAFTS_UPDATED_EVENT,
	hasDraftContent,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../services/draftStore';
import {
	getPracticeSnapshot,
	subscribePractice
} from '../practice/practiceMode';
import { getDraftNavigationScope } from '../services/draftNavigation';

const REFRESH_INTERVAL_MS = 60000;
const EMPTY: IUserDraftItem[] = [];
type LoadedDrafts = {
	identity: ReturnType<typeof getDraftAuthSessionIdentity>;
	practice: ReturnType<typeof getPracticeSnapshot>;
	items: IUserDraftItem[];
};

/** Read only the current session's recoverable drafts. */
export const useRemoteDrafts = (enabled = true): IUserDraftItem[] => {
	const [loaded, setLoaded] = useState<LoadedDrafts | null>(null);

	useEffect(() => {
		setLoaded(null);
		if (!enabled) return;

		let active = true;
		let latestRequest = 0;
		const refresh = async () => {
			const request = ++latestRequest;
			const identity = getDraftAuthSessionIdentity();
			const practice = getPracticeSnapshot();
			try {
				const response = await apiFetchUserDrafts(0, 200);
				if (
					!active ||
					request !== latestRequest ||
					identity !== getDraftAuthSessionIdentity() ||
					practice !== getPracticeSnapshot()
				) {
					return;
				}
				setLoaded({
					identity,
					practice,
					items: response.items.filter(
						(item) =>
							item.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE &&
							hasDraftContent(item.text) &&
							getDraftNavigationScope(item) !== null
					)
				});
			} catch {
				// Keep the last good result of this session on a transient read failure.
			}
		};
		const reload = () => {
			void refresh();
		};
		const invalidate = () => {
			setLoaded(null);
			reload();
		};
		const removeCryptoListener =
			subscribeDraftCryptographyForWindow(invalidate);
		const removePracticeListener = subscribePractice(invalidate);
		window.addEventListener(DRAFTS_UPDATED_EVENT, reload);
		window.addEventListener('focus', reload);
		const interval = window.setInterval(reload, REFRESH_INTERVAL_MS);
		reload();
		return () => {
			active = false;
			window.clearInterval(interval);
			window.removeEventListener(DRAFTS_UPDATED_EVENT, reload);
			window.removeEventListener('focus', reload);
			removeCryptoListener();
			removePracticeListener();
		};
	}, [enabled]);

	return enabled &&
		loaded &&
		loaded.identity === getDraftAuthSessionIdentity() &&
		loaded.practice === getPracticeSnapshot()
		? loaded.items
		: EMPTY;
};
