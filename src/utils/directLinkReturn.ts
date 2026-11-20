/* #1795: a direct link the person signs in from, and comes back to. */

/** Where a signed-out person signs in and comes back to the link. */
export const loginPathForDirectLink = (token: string) =>
	`/login?${new URLSearchParams({ returnTo: `/invite/${token}` })}`;

/** Only `/invite/<token>` survives the login as a return path. */
export const directLinkReturnPath = (
	candidate: string | null | undefined
): string | null => {
	const match = candidate?.match(/^\/invite\/([A-Za-z0-9_-]{1,128})$/);
	return match ? `/invite/${match[1]}` : null;
};
