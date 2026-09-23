export const buildRegistrationLink = (
	registrationUrl: string,
	gcid?: string | null,
	aid?: string | null
): string => {
	if (!gcid?.trim()) return registrationUrl;
	const url = new URL(registrationUrl);
	url.searchParams.set('gcid', gcid.trim());
	// The group's agency: registration preselects it instead of asking (#1499).
	if (aid?.trim()) url.searchParams.set('aid', aid.trim());
	return url.toString();
};
