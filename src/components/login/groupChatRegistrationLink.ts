export const buildRegistrationLink = (
	registrationUrl: string,
	gcid?: string | null
): string => {
	if (!gcid?.trim()) return registrationUrl;
	const url = new URL(registrationUrl);
	url.searchParams.set('gcid', gcid.trim());
	return url.toString();
};
