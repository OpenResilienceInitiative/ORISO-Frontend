/**
 * A counsellor's public contact-link name (ORISO-UserService#1534): lowercase
 * letters and digits in segments joined by single hyphens, e.g.
 * `qa-shazia-2810`. Mirrors the UserService rule (`PublicSlugFormat`), which
 * stays the authority.
 */
export const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isValidPublicSlug = (slug: string): boolean =>
	PUBLIC_SLUG_PATTERN.test(slug);

/** The link the registration page resolves: `?cid=<link name or user id>`. */
export const buildPersonalRegistrationLink = (
	registrationUrl: string,
	consultantIdentifier: string
): string =>
	`${registrationUrl}?cid=${encodeURIComponent(consultantIdentifier)}`;
