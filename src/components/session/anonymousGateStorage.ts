/**
 * The anonymous asker's gate progress for one session, kept per tab in
 * sessionStorage by the chat (consent accepted, pseudonym confirmed, "Jetzt
 * Chat starten" pressed). Shared with the Activity Timeline preview (#1824)
 * so it blocks the composer exactly while the chat does.
 */
export const anonymousGateKeys = (sessionId: number | string) => ({
	consent: `anonymous-inquiry-consent-${sessionId}`,
	pseudonym: `anonymous-pseudonym-${sessionId}`,
	waitingDismissed: `anonymous-waiting-dismissed-${sessionId}`
});

const readFlag = (key: string): boolean => {
	try {
		return sessionStorage.getItem(key) === '1';
	} catch {
		return false;
	}
};

export const readAnonymousGateState = (
	sessionId: number | string | null | undefined
) => {
	if (sessionId === null || sessionId === undefined || sessionId === '') {
		return {
			consentAccepted: false,
			pseudonymConfirmed: false,
			waitingGateDismissed: false
		};
	}
	const keys = anonymousGateKeys(sessionId);
	return {
		consentAccepted: readFlag(keys.consent),
		pseudonymConfirmed: readFlag(keys.pseudonym),
		waitingGateDismissed: readFlag(keys.waitingDismissed)
	};
};
