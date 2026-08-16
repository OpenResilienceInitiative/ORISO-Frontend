export interface OsmAddressParts {
	street?: string;
	houseNumber?: string;
	postcode?: string;
	city?: string;
}

/**
 * Search-based OSM link: works without geocoordinates (the agency model has
 * none) by letting openstreetmap.org resolve the postal address itself.
 */
export const buildOsmSearchUrl = (parts: OsmAddressParts): string | null => {
	const line1 = [parts.street, parts.houseNumber].filter(Boolean).join(' ');
	const line2 = [parts.postcode, parts.city].filter(Boolean).join(' ');
	const query = [line1, line2].filter((line) => line.length > 0).join(', ');

	if (!query) {
		return null;
	}
	return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
};
