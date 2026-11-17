import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../../../globalState';
import {
	buildSectionFaviconSvg,
	resolveSectionNavItem,
	sectionIconOf,
	svgToPngDataUrl,
	toSvgDataUrl,
	type SectionNavItem
} from './sectionFaviconSvg';
import { restoreDefaultTabIcon, showSectionTabIcon } from './tabIconLinks';

/**
 * Gives the browser tab the icon of the section the person is in (Kalender,
 * Beratungen, Profil, …), drawn in the tenant colour. Mounted inside the
 * authenticated app shell only, so before login and on plain pages the
 * default favicon stays; leaving the shell (logout) restores it.
 */
export const SectionFavicon = ({
	navigation
}: {
	navigation: ReadonlyArray<SectionNavItem | null | undefined> | undefined;
}) => {
	const { pathname } = useLocation();
	const primaryColor = useTenant()?.theming?.primaryColor;
	const item = resolveSectionNavItem(pathname, navigation);
	const Icon = item ? sectionIconOf(item) : null;

	useEffect(() => {
		if (!Icon) {
			restoreDefaultTabIcon();
			return;
		}
		let current = true;
		const svg = buildSectionFaviconSvg(Icon, primaryColor);
		const svgHref = toSvgDataUrl(svg);
		showSectionTabIcon({ svgHref, pngHref: null });
		svgToPngDataUrl(svg).then((pngHref) => {
			if (current && pngHref) showSectionTabIcon({ svgHref, pngHref });
		});
		return () => {
			current = false;
		};
	}, [Icon, primaryColor]);

	useEffect(() => () => restoreDefaultTabIcon(), []);

	return null;
};

export default SectionFavicon;
