export type SessionClassificationInput = {
	registrationType?: string | null;
	postcode?: number | string | null;
	usernames?: Array<string | null | undefined>;
};

export const isAnonymousUsername = (username?: string | null): boolean =>
	typeof username === 'string' &&
	(username.startsWith('Anonymous-') || username.startsWith('anon_'));

export const getDisplayablePostcode = (
	postcode?: number | string | null
): string | null => {
	if (postcode === null || postcode === undefined) {
		return null;
	}

	const value = String(postcode).trim();
	if (!value || value === '0' || value === '00000') {
		return null;
	}

	return value;
};

export const isAnonymousAskerCandidate = ({
	registrationType,
	postcode,
	usernames = []
}: SessionClassificationInput): boolean => {
	if (registrationType === 'ANONYMOUS') {
		return true;
	}

	if (usernames.some(isAnonymousUsername)) {
		return true;
	}

	if (postcode === null || postcode === undefined || postcode === '') {
		return false;
	}

	const value = String(postcode).trim();
	return value === '0' || value === '00000';
};
