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
