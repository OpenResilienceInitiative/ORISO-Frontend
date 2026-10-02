export const EMAIL_PREFERENCES_PATH = '/profile/einstellungen/email';

/** Only the known local settings route may survive an unauthenticated redirect. */
export const emailPreferencesReturnPath = (
	candidate: string | null | undefined
): string | null => {
	if (!candidate?.startsWith('/') || candidate.startsWith('//')) return null;

	try {
		const url = new URL(candidate, 'https://oriso.invalid');
		if (
			url.origin !== 'https://oriso.invalid' ||
			url.pathname !== EMAIL_PREFERENCES_PATH
		) {
			return null;
		}
		const occasion = url.searchParams.get('mail');
		return occasion && /^[a-z0-9-]{1,64}$/.test(occasion)
			? `${EMAIL_PREFERENCES_PATH}?${new URLSearchParams({ mail: occasion })}`
			: EMAIL_PREFERENCES_PATH;
	} catch {
		return null;
	}
};

export const loginPathForEmailPreferences = (currentPath: string): string => {
	const returnTo = emailPreferencesReturnPath(currentPath);
	return returnTo ? `/login?${new URLSearchParams({ returnTo })}` : '/login';
};
