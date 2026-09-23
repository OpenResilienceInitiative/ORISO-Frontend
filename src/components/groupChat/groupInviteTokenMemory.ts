/**
 * The invite token a counsellor arrived with, per group, for this tab only
 * (#1499 item 14). Knocking needs it (ORISO-UserService#1243); the login
 * redirect is where it is read, the session view is where it is used. Kept
 * in `sessionStorage` so a reload of the session view still has it, never in
 * the route or anywhere shared. Storage may be unavailable (private mode):
 * then it lives in memory until the tab closes.
 */
const KEY = (seriesId: number | string) => `oriso.groupInviteToken.${seriesId}`;
const memory = new Map<string, string>();

export const rememberGroupInviteToken = (
	seriesId: number | string,
	token: string
) => {
	memory.set(String(seriesId), token);
	try {
		window.sessionStorage.setItem(KEY(seriesId), token);
	} catch {
		/* memory only */
	}
};

export const groupInviteTokenFor = (
	seriesId: number | string
): string | undefined => {
	try {
		const stored = window.sessionStorage.getItem(KEY(seriesId));
		if (stored) return stored;
	} catch {
		/* memory only */
	}
	return memory.get(String(seriesId));
};

export const forgetGroupInviteToken = (seriesId: number | string) => {
	memory.delete(String(seriesId));
	try {
		window.sessionStorage.removeItem(KEY(seriesId));
	} catch {
		/* memory only */
	}
};
