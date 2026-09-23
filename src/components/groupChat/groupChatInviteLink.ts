/**
 * `aid` is the group's Beratungsstelle. Before login a newcomer cannot look the
 * group up, so without it registration falls back to topic → postcode → agency,
 * where the group's own agency is often not listed (#1499, gcid=19 on dev).
 */
/**
 * `gcid` is `<seriesId>.<inviteToken>` (ORISO-UserService#1237). The number alone
 * is guessable, so the server only lets someone join who also holds the token.
 * It rides inside `gcid` so login, registration and the post-login redirect,
 * which already pass `gcid` along, carry it without knowing about it.
 */
export const formatGroupChatInviteId = (
	seriesId: number | string,
	inviteToken?: string | null
) => (inviteToken ? `${seriesId}.${inviteToken}` : String(seriesId));

const INVITE_ID = /^(\d+)(?:\.([A-Za-z0-9_-]+))?$/;

/** The group number and token of a `gcid`, or null when it is not one. */
export const parseGroupChatInviteId = (
	gcid?: string | null
): { seriesId: string; inviteToken?: string } | null => {
	const match = INVITE_ID.exec(gcid?.trim() ?? '');
	if (!match) {
		return null;
	}
	return match[2]
		? { seriesId: match[1], inviteToken: match[2] }
		: { seriesId: match[1] };
};

export const buildGroupChatInviteLink = (
	loginUrl: string,
	seriesId: number,
	agencyId?: number | null,
	inviteToken?: string | null
) => {
	const url = new URL(loginUrl);
	url.searchParams.set(
		'gcid',
		formatGroupChatInviteId(seriesId, inviteToken)
	);
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
	agencyId?: number | null,
	inviteToken?: string | null
) =>
	buildGroupChatInviteLink(
		`${origin.replace(/\/+$/, '')}/login`,
		seriesId,
		agencyId,
		inviteToken
	);

export const currentHostGroupChatInviteLink = (
	seriesId: number,
	agencyId?: number | null,
	inviteToken?: string | null
) =>
	buildGroupChatInviteLinkForOrigin(
		window.location.origin,
		seriesId,
		agencyId,
		inviteToken
	);
