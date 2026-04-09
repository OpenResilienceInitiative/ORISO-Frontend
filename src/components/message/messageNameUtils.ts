const normalizeMatrixLikeValue = (rawValue?: string) => {
	const value = (rawValue || '').trim();
	if (!value) {
		return '';
	}

	let normalized = value;
	if (normalized.startsWith('@')) {
		normalized = normalized.slice(1);
	}
	if (normalized.includes(':')) {
		normalized = normalized.split(':')[0];
	}
	return normalized.trim();
};

const resolvePreferredName = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => {
	const normalizedFirstName = (firstName || '').trim();
	const normalizedLastName = (lastName || '').trim();
	const combinedRealName =
		`${normalizedFirstName} ${normalizedLastName}`.trim();
	if (combinedRealName) {
		return combinedRealName;
	}

	const normalizedDisplayName = normalizeMatrixLikeValue(rawDisplayName);
	if (normalizedDisplayName) {
		return normalizedDisplayName;
	}

	return normalizeMatrixLikeValue(rawUsername);
};

export const formatMessagePersonName = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => resolvePreferredName(rawDisplayName, rawUsername, firstName, lastName);

export const getMessagePersonInitials = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => {
	const resolvedName = resolvePreferredName(
		rawDisplayName,
		rawUsername,
		firstName,
		lastName
	);
	if (!resolvedName) {
		return 'U';
	}

	const parts = resolvedName.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
	}

	const alphanumericOnly = parts[0].replace(/[^a-zA-Z0-9]/g, '');
	if (alphanumericOnly.length >= 2) {
		return alphanumericOnly.slice(0, 2).toUpperCase();
	}
	return parts[0].slice(0, 2).toUpperCase();
};
