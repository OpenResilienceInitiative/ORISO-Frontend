/**
 * FE#1870 — an Erstanfrage that came in through the agency link
 * (Beratungsstellen-Link, `?aid=`) carries a small label in the counsellor's
 * list, so the counsellor sees the person found them through their own link.
 *
 * Only the channel is stored: registration sends `referer: 'aidlink'`
 * (UserService keeps it on the session, `[a-zA-Z0-9]{1,8}`), and the list gets
 * back `SessionDTO.viaAgencyLink`. The Träger can switch the label off with
 * the tenant setting `featureAgencyLinkLabelEnabled` (default on).
 */
export const AGENCY_LINK_REFERER = 'aidlink';

export const AGENCY_LINK_LABEL_KEY = 'sessionList.item.sessionType.agencyLink';

type AgencyLinkRegistration = {
	/** `aid` from the registration URL. */
	aid?: string | null;
	/** The agency the person actually registers with. */
	agencyId?: string | number | null;
	/** A counsellor link (`cid`) skips Erstanfragen, so it is never labelled. */
	viaConsultantLink?: boolean;
	/** Joining a self-help group opens no enquiry. */
	viaGroupJoin?: boolean;
};

/**
 * The `referer` to send with the registration, or undefined. Only when the
 * person registers with exactly the agency the link names.
 */
export const agencyLinkReferer = ({
	aid,
	agencyId,
	viaConsultantLink,
	viaGroupJoin
}: AgencyLinkRegistration): string | undefined => {
	if (!aid || agencyId == null || viaConsultantLink || viaGroupJoin) {
		return undefined;
	}
	return String(agencyId) === String(aid) ? AGENCY_LINK_REFERER : undefined;
};

/** Whether the list row shows the agency-link label. */
export const showsAgencyLinkLabel = (
	session: { viaAgencyLink?: boolean } | undefined,
	settings: { featureAgencyLinkLabelEnabled?: boolean } | undefined | null
): boolean =>
	session?.viaAgencyLink === true &&
	settings?.featureAgencyLinkLabelEnabled !== false;

/** Spread into the registration payload: `{ referer }` or nothing. */
export const withAgencyLinkReferer = (
	registration: AgencyLinkRegistration
): { referer?: string } => {
	const referer = agencyLinkReferer(registration);
	return referer ? { referer } : {};
};
