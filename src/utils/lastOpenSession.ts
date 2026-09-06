/**
 * Remember the consultant's last-open session so sign-in can resume it
 * (#1193 Job 3). Stored per user in localStorage; the value is only an
 * in-app route (session/group ids), never message content.
 */

const KEY_PREFIX = 'oriso.lastOpenSession.';
/** Entries older than this are ignored (shared-workstation hygiene). */
export const LAST_OPEN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredEntry = { path: string; ts: number };

const parseEntry = (raw: string | null | undefined): StoredEntry | null => {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed === 'object' &&
			typeof parsed.path === 'string' &&
			typeof parsed.ts === 'number'
		) {
			return parsed as StoredEntry;
		}
	} catch {
		// not JSON → treated as invalid below
	}
	return null;
};

/**
 * Consultant session detail routes only (see RouterConfig detailRoutes):
 *   /sessions/consultant/sessionView/session/:sessionId
 *   /sessions/consultant/sessionView/:groupId/:sessionId
 * `sessionPreview` (enquiries) is deliberately excluded: those move away once
 * accepted and would resume into a dead end.
 */
const SESSION_VIEW_PATH =
	/^\/sessions\/consultant\/sessionView\/(?:session\/\d+|[^/?#\\]+\/\d+)\/?$/;

export const isRestorableSessionPath = (path: unknown): path is string =>
	typeof path === 'string' && SESSION_VIEW_PATH.test(path);

const storageKey = (userId: string) => `${KEY_PREFIX}${userId}`;

const getStorage = (): Storage | null => {
	try {
		return typeof window !== 'undefined' ? window.localStorage : null;
	} catch {
		return null;
	}
};

export const rememberLastOpenSession = (
	userId: string | undefined,
	path: string
): void => {
	if (!userId || !isRestorableSessionPath(path)) {
		return;
	}
	try {
		const entry: StoredEntry = { path, ts: Date.now() };
		getStorage()?.setItem(storageKey(userId), JSON.stringify(entry));
	} catch {
		// storage full / disabled: resuming is a convenience, never an error
	}
};

export const readLastOpenSession = (
	userId: string | undefined
): string | null => {
	if (!userId) {
		return null;
	}
	try {
		const raw = getStorage()?.getItem(storageKey(userId));
		if (raw == null) {
			return null;
		}
		const entry = parseEntry(raw);
		if (!entry || !isRestorableSessionPath(entry.path)) {
			// Corrupt or tampered: drop it rather than keep re-reading it.
			clearLastOpenSession(userId);
			return null;
		}
		const age = Date.now() - entry.ts;
		// Non-finite or future timestamps are tampered/corrupt: never extend the TTL.
		if (
			!Number.isFinite(age) ||
			age < 0 ||
			age > LAST_OPEN_SESSION_TTL_MS
		) {
			clearLastOpenSession(userId);
			return null;
		}
		return entry.path;
	} catch {
		return null;
	}
};

export const clearLastOpenSession = (userId: string | undefined): void => {
	if (!userId) {
		return;
	}
	try {
		getStorage()?.removeItem(storageKey(userId));
	} catch {
		// ignore
	}
};
