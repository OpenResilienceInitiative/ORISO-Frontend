/**
 * "Anfrage gestellt" on a recommendation card (FE#1876), remembered per
 * message in this browser. A convenience only: storage may be blocked or
 * cleared, so every access is guarded and the card simply shows its button.
 */
const KEY_PREFIX = 'oriso.furtherCounselling.requested.';

export const hasRequestedFromCard = (messageId?: string | null): boolean => {
	if (!messageId) return false;
	try {
		return window.localStorage.getItem(KEY_PREFIX + messageId) === '1';
	} catch {
		return false;
	}
};

export const markRequestedFromCard = (messageId?: string | null): void => {
	if (!messageId) return;
	try {
		window.localStorage.setItem(KEY_PREFIX + messageId, '1');
	} catch {
		/* storage blocked: the status line just does not persist */
	}
};
