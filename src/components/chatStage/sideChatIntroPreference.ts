import { useCallback, useContext, useSyncExternalStore } from 'react';
import { UserDataContext } from '../../globalState';

/**
 * "Nicht mehr einblenden" for the intro hint at the top of a side chat
 * (Teamberatung, Supervision). A counsellor who knows what the room is for
 * does not need the sentence above every conversation.
 *
 * There is no server-side store for UI preferences yet: the UserService
 * `tutorials/progress` API only accepts configured tour ids. So the choice is
 * kept per user in this browser, the same way the keyboard-shortcut
 * preferences are (`oriso.keyboardShortcuts.v1`, keyed by `userId`).
 */
export type SideChatIntroKind = 'team' | 'supervision';

export const SIDE_CHAT_INTRO_STORAGE_KEY = 'oriso.sideChatIntro.v1';

const ANONYMOUS_USER = '__anonymous__';

type StoredBlobV1 = {
	version: 1;
	byUser: Record<string, Partial<Record<SideChatIntroKind, true>>>;
};

const safeGetStorage = (): Storage | null => {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

const readBlob = (): StoredBlobV1 => {
	const storage = safeGetStorage();
	try {
		const raw = storage?.getItem(SIDE_CHAT_INTRO_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		if (
			parsed?.version === 1 &&
			parsed.byUser &&
			typeof parsed.byUser === 'object'
		) {
			return parsed as StoredBlobV1;
		}
	} catch {
		// A corrupt value shows the hint again; it never breaks the room.
	}
	return { version: 1, byUser: {} };
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key === SIDE_CHAT_INTRO_STORAGE_KEY) listener();
	};
	if (typeof window !== 'undefined') {
		window.addEventListener('storage', onStorage);
	}
	return () => {
		listeners.delete(listener);
		if (typeof window !== 'undefined') {
			window.removeEventListener('storage', onStorage);
		}
	};
};

const userKey = (userId?: string | null) => userId || ANONYMOUS_USER;

export const isSideChatIntroDismissed = (
	userId: string | null | undefined,
	kind: SideChatIntroKind
): boolean => readBlob().byUser[userKey(userId)]?.[kind] === true;

export const setSideChatIntroDismissed = (
	userId: string | null | undefined,
	kind: SideChatIntroKind,
	dismissed: boolean
): void => {
	const blob = readBlob();
	const key = userKey(userId);
	const entry = { ...(blob.byUser[key] || {}) };
	if (dismissed) {
		entry[kind] = true;
	} else {
		delete entry[kind];
	}
	blob.byUser[key] = entry;
	try {
		safeGetStorage()?.setItem(
			SIDE_CHAT_INTRO_STORAGE_KEY,
			JSON.stringify(blob)
		);
	} catch {
		// Storage full or blocked: the hint simply comes back next time.
	}
	notify();
};

/**
 * `[dismissed, dismiss]` for the signed-in counsellor. Every hook instance
 * re-renders on a change, so the button inside the timeline item and the
 * timeline builder in the session view stay in step.
 */
export const useSideChatIntroDismissed = (
	kind: SideChatIntroKind
): [boolean, () => void] => {
	const userId = useContext(UserDataContext)?.userData?.userId ?? null;
	const dismissed = useSyncExternalStore(
		subscribe,
		() => isSideChatIntroDismissed(userId, kind),
		() => false
	);
	const dismiss = useCallback(
		() => setSideChatIntroDismissed(userId, kind, true),
		[userId, kind]
	);
	return [dismissed, dismiss];
};
