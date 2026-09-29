export const buildGroupChatInviteLink = (
	loginUrl: string,
	seriesId: number
) => {
	const url = new URL(loginUrl);
	url.searchParams.set('gcid', String(seriesId));
	return url.toString();
};

/**
 * The invite link for the host the app is running on right now (#1499).
 *
 * The origin is passed in (the caller gives `window.location.origin`) instead
 * of coming from configuration: invite mails pointed at the production host from a
 * dev host last week because a configured production URL won. A link shared
 * from dev, pre-dev or a Träger's own domain must lead back to that host.
 */
export const buildGroupChatInviteLinkForOrigin = (
	origin: string,
	seriesId: number
) => buildGroupChatInviteLink(`${origin.replace(/\/+$/, '')}/login`, seriesId);

export const currentHostGroupChatInviteLink = (seriesId: number) =>
	buildGroupChatInviteLinkForOrigin(window.location.origin, seriesId);
