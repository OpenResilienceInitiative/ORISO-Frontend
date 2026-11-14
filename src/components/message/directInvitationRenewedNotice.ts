/**
 * ORISO-Frontend#2252 "Neuen Link senden": the UserService posts this notice
 * into the invitation's conversation (`DirectInvitationService.RENEWED_TYPE`).
 * It carries the new link and when it stops working; the wording is
 * translated here, in the reader's own language.
 */
export const SYSTEM_NOTIFICATION_DIRECT_INVITATION_RENEWED =
	'DIRECT_INVITATION_RENEWED';

export interface DirectInvitationRenewedNotice {
	url: string;
	expiresAt?: string;
}

/** Only a web link is drawn as a link; anything else is not a new link. */
const webUrl = (value: unknown): string | null => {
	if (typeof value !== 'string' || !value.trim()) return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' || url.protocol === 'http:'
			? url.toString()
			: null;
	} catch {
		return null;
	}
};

export const parseDirectInvitationRenewedNotice = (
	payload: unknown
): DirectInvitationRenewedNotice | null => {
	if (!payload || typeof payload !== 'object') return null;
	const { type, url, expiresAt } = payload as Record<string, unknown>;
	if (type !== SYSTEM_NOTIFICATION_DIRECT_INVITATION_RENEWED) return null;
	const link = webUrl(url);
	if (!link) return null;
	return typeof expiresAt === 'string' && expiresAt.trim()
		? { url: link, expiresAt: expiresAt.trim() }
		: { url: link };
};

export const directInvitationRenewedNoticeText = (
	notice: DirectInvitationRenewedNotice,
	translate: (key: string, options?: Record<string, unknown>) => string,
	locale: string
): { title: string; description: string } => {
	const expires = notice.expiresAt ? new Date(notice.expiresAt) : null;
	return {
		title: translate('directInvitation.renewed.title'),
		description:
			expires && Number.isFinite(expires.getTime())
				? translate('directInvitation.renewed.validUntil', {
						date: expires.toLocaleString(locale, {
							weekday: 'short',
							day: 'numeric',
							month: 'short',
							hour: '2-digit',
							minute: '2-digit'
						})
					})
				: translate('directInvitation.renewed.text')
	};
};
