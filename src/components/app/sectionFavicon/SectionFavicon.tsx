import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { restoreDefaultTitle, showSectionTitle } from './tabTitle';

/**
 * Gives the browser tab the name and icon of the section the person is in (Kalender,
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
	const { t: translate, i18n } = useTranslation();
	const titleKey = (item?.titleKeys as { large?: string } | undefined)?.large;
	// Only the section name, in the active language (Frank, 2026-11-17).
	const sectionTitle = titleKey ? translate(titleKey) : null;
	const tenant = useTenant();

	useEffect(() => {
		if (sectionTitle) showSectionTitle(sectionTitle);
		else restoreDefaultTitle();
	}, [sectionTitle, i18n.language, tenant]);

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

	useEffect(
		() => () => {
			restoreDefaultTabIcon();
			restoreDefaultTitle();
		},
		[]
	);

	return null;
};

export default SectionFavicon;
