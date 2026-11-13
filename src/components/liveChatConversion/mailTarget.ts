/** Before redemption there is no identity to promote. Afterwards, keep it. */
export const mailTarget = (sessionId: number | null): string =>
	sessionId === null ? '/registration' : '/live-chat/convert';
