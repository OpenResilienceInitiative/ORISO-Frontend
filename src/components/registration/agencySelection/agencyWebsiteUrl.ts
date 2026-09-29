// A hostname with at least one dot and an alphabetic TLD, optional port and
// path. Deliberately strict: anything else renders no link (ORISO-Helm#368).
const BARE_HOST =
	/^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+\p{L}{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/u;

const toWebHref = (candidate: string): string | undefined => {
	try {
		const parsed = new URL(candidate);
		return parsed.protocol === 'https:' || parsed.protocol === 'http:'
			? parsed.href
			: undefined;
	} catch {
		return undefined;
	}
};

/**
 * Link target for an agency website as entered in the admin panel.
 * Absolute http(s) URLs pass through; a bare host such as
 * `www.beratung.example.org` gets `https://`. Nothing is ever resolved
 * against another base URL.
 */
export const agencyWebsiteHref = (
	value: string | undefined
): string | undefined => {
	const trimmed = value?.trim();
	if (!trimmed) {
		return undefined;
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return toWebHref(trimmed);
	}
	return BARE_HOST.test(trimmed)
		? toWebHref(`https://${trimmed}`)
		: undefined;
};
