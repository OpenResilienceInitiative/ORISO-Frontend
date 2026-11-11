import type { IUserDraftItem } from '../api/apiUserDrafts';
import { isPracticeDraftScope } from '../practice/practiceDraftScopes';
import { getPracticeSnapshot } from '../practice/practiceMode';
import {
	addressesPracticeCase,
	addressesRealCase
} from '../practice/practiceRouteGuard';
import { isOpaqueDraftScope } from './draftCryptography';

export const getDraftNavigationScope = (
	draft: IUserDraftItem
): string | null => {
	const practice = getPracticeSnapshot();
	if (practice.status !== 'inactive') {
		return practice.status === 'active' &&
			isPracticeDraftScope(draft.scopeKey)
			? draft.scopeKey
			: null;
	}
	return isOpaqueDraftScope(draft.opaqueScopeKey)
		? draft.opaqueScopeKey
		: null;
};

const routeOrigin = 'https://draft-route.invalid';

export const toDraftResumePath = (
	draft: IUserDraftItem,
	embedded = false,
	fallback?: string
): string | null => {
	const path = draft.actionPath || fallback;
	const scope = getDraftNavigationScope(draft);
	if (!path?.startsWith('/') || !scope) return null;

	const url = new URL(path, routeOrigin);
	if (url.origin !== routeOrigin) return null;
	const inPractice = getPracticeSnapshot().status === 'active';
	if (
		inPractice
			? addressesRealCase(url.pathname)
			: addressesPracticeCase(url.pathname)
	) {
		return null;
	}
	url.searchParams.delete('embeddedNotifications');
	url.searchParams.set('draftScopeKey', scope);
	if (embedded) url.searchParams.set('embeddedNotifications', '1');
	return url.pathname + url.search + url.hash;
};
