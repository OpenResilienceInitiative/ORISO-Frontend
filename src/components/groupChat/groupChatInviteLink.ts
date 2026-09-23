/**
 * `aid` is the group's Beratungsstelle. Before login a newcomer cannot look the
 * group up, so without it registration falls back to topic → postcode → agency,
 * where the group's own agency is often not listed (#1499, gcid=19 on dev).
 */
export const buildGroupChatInviteLink = (
	loginUrl: string,
	seriesId: number,
	agencyId?: number | null
) => {
	const url = new URL(loginUrl);
	url.searchParams.set('gcid', String(seriesId));
	if (agencyId != null) {
		url.searchParams.set('aid', String(agencyId));
	}
	return url.toString();
};

/**
 * The invite link for the host the app is running on right now (#1499).
 *
 * The origin is passed in (the caller gives `window.location.origin`) instead
 * of coming from configuration: invite mails pointed at app.oriso.org from a
 * dev host last week because a configured production URL won. A link shared
 * from dev, pre-dev or a Träger's own domain must lead back to that host.
 */
export const buildGroupChatInviteLinkForOrigin = (
	origin: string,
	seriesId: number,
	agencyId?: number | null
) =>
	buildGroupChatInviteLink(
		`${origin.replace(/\/+$/, '')}/login`,
		seriesId,
		agencyId
	);

export const currentHostGroupChatInviteLink = (
	seriesId: number,
	agencyId?: number | null
) =>
	buildGroupChatInviteLinkForOrigin(
		window.location.origin,
		seriesId,
		agencyId
	);
