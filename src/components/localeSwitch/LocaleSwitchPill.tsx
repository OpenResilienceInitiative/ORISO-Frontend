import * as React from 'react';
import { useCallback, useContext, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Menu, MenuItem } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { LocaleContext } from '../../globalState';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import './localeSwitchPill.styles';

export interface LocaleSwitchPillProps {
	/**
	 * `pill` — the desktop control: globe in a circle, plain language name,
	 * ISO code, chevron. `circle` — the compact control for the mobile hero:
	 * a translucent globe button on the red surface.
	 */
	variant?: 'pill' | 'circle';
	className?: string;
}

/** `de@informal` and `de-DE` both display as "DE". */
const toIsoLabel = (locale: string) => locale.split(/[-_@]/)[0].toUpperCase();

/**
 * The `languages` namespace ships its labels as "(DE) Deutsch". This control
 * shows the ISO code in its own slot (design 2d), so the prefix is stripped
 * rather than printed twice.
 */
const stripIsoPrefix = (label: string) =>
	label.replace(/^\(\s*[A-Za-z-]+\s*\)\s*/, '');

/**
 * Endonyms for the platform's core locales — each language named in itself.
 *
 * A language menu must be readable by someone who cannot read the current UI
 * language, so exonyms ("Russian" on a German UI) are wrong here by design.
 * The `languages` catalogues cannot provide this: they name languages in the
 * catalogue's own language (and the non-English catalogues silently fall back
 * to English for every entry nobody translated, which is what produced the
 * mixed "Deutsch, Englisch, Russian, Tigrinya…" menu).
 */
const CORE_ENDONYMS: Record<string, string> = {
	de: 'Deutsch',
	en: 'English',
	fr: 'Français',
	ru: 'Русский',
	ti: 'ትግርኛ',
	tr: 'Türkçe',
	uk: 'Українська'
};

/**
 * Endonym for a locale: curated map first, then the browser's CLDR data
 * (`Intl.DisplayNames` in the language's own locale, capitalised for a
 * standalone label), then the catalogue label as the last resort.
 */
const toEndonym = (locale: string, catalogueLabel: string) => {
	const base = locale.split(/[-_@]/)[0].toLowerCase();
	if (CORE_ENDONYMS[base]) {
		return CORE_ENDONYMS[base];
	}
	try {
		const name = new Intl.DisplayNames([base], {
			type: 'language'
		}).of(base);
		if (name && name !== base) {
			// CLDR autonyms can be lowercase ("русский"); the menu shows them
			// as standalone labels, so the first letter is capitalised.
			return name.charAt(0).toLocaleUpperCase(base) + name.slice(1);
		}
	} catch {
		// Unknown tag or missing CLDR data — fall through to the catalogue.
	}
	return catalogueLabel;
};

/**
 * Language switch for the public stage screens (design 2d / 2e).
 *
 * Deliberately not the react-select based {@link LocaleSwitch}: that one is
 * shared with the in-app navigation and its style overrides cannot express
 * this control without putting every other call site at risk. Same context,
 * same cookie, same locale handling — only the presentation differs.
 */
export const LocaleSwitchPill = ({
	variant = 'pill',
	className
}: LocaleSwitchPillProps) => {
	const { t: translate } = useTranslation(['common', 'languages']);
	const { locale, setLocale, selectableLocales } = useContext(LocaleContext);
	const anchorRef = useRef<HTMLButtonElement>(null);
	const [isOpen, setIsOpen] = useState(false);

	const close = useCallback(() => setIsOpen(false), []);
	const select = useCallback(
		(value: string) => {
			// The cookie has to be written before the locale changes: requests
			// triggered by the re-render already read it. Same order as in
			// LocaleSwitch.
			setValueInCookie('lang', value);
			setLocale(value);
			setIsOpen(false);
		},
		[setLocale]
	);

	if (selectableLocales.length <= 1) {
		return null;
	}

	const languageName = (lng: string) =>
		toEndonym(
			lng,
			stripIsoPrefix(translate([lng, lng], { ns: 'languages' }) as string)
		);

	return (
		<>
			<button
				ref={anchorRef}
				type="button"
				className={clsx(
					'localeSwitchPill',
					`localeSwitchPill--${variant}`,
					className
				)}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-label={translate('app.selectLanguage')}
				onClick={() => setIsOpen(true)}
			>
				<span className="localeSwitchPill__globe">
					<LanguageIcon fontSize="inherit" />
				</span>
				{variant === 'pill' && (
					<>
						<span className="localeSwitchPill__name">
							{languageName(locale)}
						</span>
						<span className="localeSwitchPill__iso">
							{toIsoLabel(locale)}
						</span>
						<KeyboardArrowDownRoundedIcon
							className="localeSwitchPill__chevron"
							fontSize="inherit"
						/>
					</>
				)}
			</button>

			<Menu
				anchorEl={anchorRef.current}
				open={isOpen}
				onClose={close}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				MenuListProps={{
					'role': 'listbox',
					'aria-label': translate('app.selectLanguage')
				}}
				slotProps={{
					paper: { className: 'localeSwitchPill__menu' }
				}}
			>
				{selectableLocales.map((lng) => {
					const isSelected = lng === locale;
					return (
						<MenuItem
							key={lng}
							role="option"
							aria-selected={isSelected}
							selected={isSelected}
							className={clsx('localeSwitchPill__option', {
								'localeSwitchPill__option--selected': isSelected
							})}
							onClick={() => select(lng)}
						>
							<span className="localeSwitchPill__optionCheck">
								{isSelected && (
									<CheckRoundedIcon fontSize="inherit" />
								)}
							</span>
							{languageName(lng)}
						</MenuItem>
					);
				})}
			</Menu>
		</>
	);
};
