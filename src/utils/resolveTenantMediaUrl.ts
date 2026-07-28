/**
 * Resolves a root-relative tenant media reference (`/media/{id}`, produced by
 * the admin editor upload, WP-3a/3b) against the TenantService origin.
 *
 * Legal-text HTML (imprint/privacy/DPP) is authored in the Admin and rendered
 * on the frontend origin, which — in a split api/app host topology — does not
 * route `/media/{id}` to the TenantService. Rewriting the src to the tenant
 * origin at render time makes the image load wherever the HTML is shown, while
 * the stored HTML stays origin-independent (relative).
 *
 * Only bare `/media/...` paths are rewritten. Absolute URLs, data/blob URIs,
 * and anything else pass through untouched. When the origin is empty (dev
 * same-origin proxy) the path is left relative on purpose.
 */
export const resolveTenantMediaUrl = (
	src: string | undefined,
	tenantMediaOrigin: string
): string | undefined => {
	if (!src || !tenantMediaOrigin) {
		return src;
	}
	if (!src.startsWith('/media/')) {
		return src;
	}
	return `${tenantMediaOrigin.replace(/\/$/, '')}${src}`;
};
