/**
 * The handoff from a registration that created the account but could not log
 * it in, to the login page it sends the person to (#1533).
 *
 * The login page is a new document (`redirectToLogin`), so the fact that
 * "your account exists, please log in" has to survive a load. Session storage
 * is the narrowest place that does: this tab only, gone with it, and cleared
 * by the login page on first read. It carries the User-ID the person just
 * chose, so the login form can be filled in for them — never the password.
 *
 * Every access is best-effort. Storage throws when it is disabled or full;
 * losing the handoff only costs the notice and the pre-filled field, never
 * the way to the login itself.
 */
const STORAGE_KEY = 'oriso.accountCreatedLogin';

export type AccountCreatedLogin = { username: string };

export const stageAccountCreatedLogin = (username: string): void => {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username }));
	} catch {
		/* non-fatal — the login page opens without the notice */
	}
};

export const readAccountCreatedLogin = (): AccountCreatedLogin | null => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const value = JSON.parse(raw);
		return typeof value?.username === 'string'
			? { username: value.username }
			: null;
	} catch {
		return null;
	}
};

export const clearAccountCreatedLogin = (): void => {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		/* non-fatal — the value dies with the tab either way */
	}
};
