import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';

/**
 * The postcode a temporary account is registered with. The backend knows it
 * as the placeholder of a registration that has no postcode of its own.
 */
export const DIRECT_LINK_FALLBACK_POSTCODE = '00000';

export const DIRECT_LINK_POSTCODE_LENGTH = 5;

/** The backend's rule for a postcode: exactly five digits. */
export const isDirectLinkPostcode = (value: string) => /^[0-9]{5}$/.test(value);

/**
 * ORISO-Frontend#1795: a person who registers through a direct link enters
 * a postcode (kept for statistics, it routes nothing — the link fixes agency
 * and counsellor). A temporary account is deleted after the conversation and
 * keeps the placeholder, so the knock stays one tap.
 */
export const asksDirectLinkPostcode = (
	context: Pick<InviteLinkContext, 'temporaryAccount'>
) => !context.temporaryAccount;
