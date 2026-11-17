/**
 * Point every declared tab icon at the tenant branding favicon.
 *
 * Rewriting only the first `link[rel=icon]` is not enough: an entry template may
 * declare several icon links and browsers pick the one whose `sizes` best
 * matches the tab, so the sized variants would keep serving the built-in
 * placeholder. `sizes`/`type` are stripped along the way — they described the
 * placeholder PNGs and would hand the browser a wrong type hint for an `.ico`
 * data URL.
 *
 * `rel~=` matches whitespace-separated tokens, so `rel="shortcut icon"` is
 * included while `rel="apple-touch-icon"` (a single, different token) is not.
 *
 * Mirrors ORISO-Admin `src/utils/applyBrandingFavicon.ts`, plus the
 * create-if-missing branch the frontend needs: its entry templates are rendered
 * per page type and not all of them declare an icon link.
 */
export const applyBrandingFavicon = (favicon: string): void => {
	const links =
		document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']");

	if (links.length === 0) {
		const link = document.createElement('link');
		link.setAttribute('rel', 'icon');
		link.setAttribute('href', favicon);
		document.head.appendChild(link);
		return;
	}

	links.forEach((link) => {
		// A section tab icon is showing (sectionFavicon/tabIconLinks): the
		// branding becomes the default it returns to, the section icon stays.
		if (link.hasAttribute('data-section-icon')) {
			link.setAttribute('data-default-href', favicon);
			link.setAttribute('data-default-type', '\u0000');
			link.setAttribute('data-default-sizes', '\u0000');
			return;
		}
		if (link.hasAttribute('data-section-icon-png')) return;
		link.setAttribute('href', favicon);
		link.removeAttribute('sizes');
		link.removeAttribute('type');
	});
};

export default applyBrandingFavicon;
