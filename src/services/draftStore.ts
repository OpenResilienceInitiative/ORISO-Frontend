export const DRAFT_STORAGE_KEY = 'oriso.chatDrafts.v1';
export const DRAFTS_UPDATED_EVENT = 'oriso:drafts-updated';
export const REMOTE_DRAFT_INDEX_SCOPE = 'scope:__draft-index__|thread:main';

export type DraftEntry = {
	key: string;
	userId: string;
	text: string;
	updatedAt: number;
	sessionId?: number | null;
	roomRef?: string | null;
	threadRootId?: string | null;
	actionPath?: string | null;
	title?: string | null;
};

const safeGetStorage = (): Storage | null => {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		return window.localStorage;
	} catch (_e) {
		return null;
	}
};

const parseStore = (): Record<string, DraftEntry> => {
	const storage = safeGetStorage();
	if (!storage) {
		return {};
	}
	try {
		const raw = storage.getItem(DRAFT_STORAGE_KEY);
		if (!raw) {
			return {};
		}
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') {
			return {};
		}
		return parsed;
	} catch (_e) {
		return {};
	}
};

const persistStore = (store: Record<string, DraftEntry>) => {
	const storage = safeGetStorage();
	if (!storage) {
		return;
	}
	storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(store));
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(DRAFTS_UPDATED_EVENT));
	}
};

export const buildDraftKey = (
	userId: string | number | null | undefined,
	scopeId: string | number | null | undefined,
	threadRootId?: string | null
) => {
	return [
		`u:${String(userId || 'anonymous')}`,
		`scope:${String(scopeId || 'unknown')}`,
		`thread:${threadRootId || 'main'}`
	].join('|');
};

export const saveDraftEntry = (entry: DraftEntry) => {
	const store = parseStore();
	if (!entry.text || entry.text.trim().length === 0) {
		delete store[entry.key];
		persistStore(store);
		return;
	}
	store[entry.key] = entry;
	persistStore(store);
};

export const getDraftEntry = (key: string): DraftEntry | null => {
	const store = parseStore();
	return store[key] || null;
};

export const removeDraftEntry = (key: string) => {
	const store = parseStore();
	if (!store[key]) {
		return;
	}
	delete store[key];
	persistStore(store);
};

export const getAllDraftEntries = (
	userId?: string | number | null
): DraftEntry[] => {
	const store = parseStore();
	const values = Object.values(store);
	const normalizedUserId = String(userId || '');
	return values
		.filter((entry) =>
			normalizedUserId ? entry.userId === normalizedUserId : true
		)
		.sort((a, b) => b.updatedAt - a.updatedAt);
};

