import * as React from 'react';
import './localeSwitch.styles';
import { ReactComponent as LanguageIconOutline } from '../../resources/img/icons/language_outline.svg';
import { useTranslation } from 'react-i18next';
import { useContext, useEffect, useState } from 'react';
import { UserDataContext, LocaleContext } from '../../globalState';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import {
	MENUPLACEMENT,
	MENUPLACEMENT_BOTTOM,
	MENUPLACEMENT_RIGHT,
	SelectDropdownItem
} from '../select/SelectDropdown';
import { LanguageSelectDropdown } from '../select/LanguageSelectDropdown';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import LanguageIcon from '@mui/icons-material/Language';
import { LocaleSwitchPill } from './LocaleSwitchPill';

export interface LocaleSwitchProp {
	updateUserData?: boolean;
	vertical?: boolean;
	showIcon?: boolean;
	className?: string;
	iconSize?: number;
	label?: string;
	menuPlacement?: MENUPLACEMENT;
	selectRef?: any;
	isInsideMenu?: boolean;
	color?: string;
	colorHover?: string;
	iconOnly?: boolean;
	/**
	 * `'select'` (default) is the react-select control the in-app navigation
	 * uses. `'pill'` is the login header's control from design 2d — same
	 * options, same context wiring, different surface.
	 */
	variant?: 'select' | 'pill';
	/** When set (e.g. Figma nav globe), replaces default language SVGs in the control */
	leadingIconOverride?: React.ReactNode;
	onMenuOpen?: () => void;
	onMenuClose?: () => void;
}

export const LocaleSwitch: React.FC<LocaleSwitchProp> = ({
	updateUserData,
	className,
	showIcon = true,
	vertical,
	iconSize = 20,
	menuPlacement = MENUPLACEMENT_BOTTOM,
	label,
	selectRef,
	isInsideMenu = false,
	color = 'var(--m3-on-surface)',
	colorHover = 'var(--m3-primary-hover)',
	iconOnly,
	variant = 'select',
	leadingIconOverride,
	onMenuOpen,
	onMenuClose
}) => {
	const { t: translate } = useTranslation(['common', 'languages']);

	const userDataContext = useContext(UserDataContext);
	const { locale, setLocale, selectableLocales } = useContext(LocaleContext);

	const [requestInProgress, setRequestInProgress] = useState(false);

	useEffect(() => {
		if (
			updateUserData &&
			userDataContext?.userData?.preferredLanguage !== locale &&
			!requestInProgress
		) {
			setRequestInProgress(true);
			apiPatchUserData({
				preferredLanguage: locale
			})
				.then(userDataContext.reloadUserData)
				.catch((error) => {
					/* console.log(error); */
				})
				.finally(() => {
					setRequestInProgress(false);
				});
		}
	}, [locale, requestInProgress, updateUserData, userDataContext]);

	if (selectableLocales.length <= 1) {
		return null;
	}

	const selectLocale = (value: string) => {
		// The cookie has to be written before the context switch: requests are
		// keyed off `locale`, and setting the context first fires them against
		// the old cookie.
		setValueInCookie('lang', value);
		setLocale(value);
	};

	if (variant === 'pill') {
		return (
			<LocaleSwitchPill
				className={className}
				value={locale}
				options={selectableLocales.map((lng) => ({
					value: lng,
					// The `languages` namespace ships the code inside the label
					// ("(DE) Deutsch"). The pill shows the code in its own slot,
					// so the prefix has to come off or it appears twice.
					label: translate([lng, lng], { ns: 'languages' }).replace(
						/^\([A-Z]{2}\)\s*/,
						''
					)
				}))}
				onChange={selectLocale}
				ariaLabel={translate('app.selectLanguage')}
			/>
		);
	}

	const languageSelectDropdown: SelectDropdownItem = {
		handleDropdownSelect: ({ value }) => selectLocale(value),
		id: 'languageSelect',
		className,
		selectedOptions: selectableLocales.map((lng) => ({
			label: translate([lng, lng], { ns: 'languages' }),
			value: lng
		})),
		useIconOption: false,
		isSearchable: false,
		menuPlacement: menuPlacement,
		menuPosition: 'fixed',
		selectRef,
		isInsideMenu,
		defaultValue: {
			value: locale,
			label: (
				<>
					{(showIcon || iconOnly) && (
						<>
							{leadingIconOverride ? (
								<span className="localeSwitch__leadingIconOverride">
									{leadingIconOverride}
								</span>
							) : (
								<>
									{isInsideMenu && (
										<LanguageIconOutline
											title={translate(
												'app.selectLanguage'
											)}
											aria-label={translate(
												'app.selectLanguage'
											)}
											width={iconSize}
											height={iconSize}
											className="navigation__icon__outline"
										/>
									)}
									<LanguageIcon
										aria-label={translate(
											'app.selectLanguage'
										)}
										width={iconSize}
										height={iconSize}
										className="navigation__icon__filled"
										color="inherit"
										style={{
											width: 'auto',
											height: 'auto'
										}}
									/>
								</>
							)}
						</>
					)}{' '}
					{!iconOnly && (
						<span>
							{label
								? label
								: translate([locale, locale], {
										ns: 'languages'
									})}
						</span>
					)}
				</>
			)
		},
		styleOverrides: {
			menu: (base) => ({
				...base,
				width: 'auto',
				...(iconOnly &&
					menuPlacement === MENUPLACEMENT_RIGHT && {
						left: '-100%'
					}),
				...(iconOnly &&
					menuPlacement !== MENUPLACEMENT_RIGHT && {
						left: 'auto',
						right: 0
					})
			}),
			control: () => ({
				//'padding': '8px 12px',
				'height': 'auto',
				'border': 0,
				'&:hover': {
					border: 0
				},
				// Nav only
				'background': 'none',
				'padding': '0',
				'justifyContent': 'center'
			}),
			dropdownIndicator: () => ({
				display: 'none'
			}),
			menuSwitch: () => {
				return (
					iconOnly && {
						display: 'inline-block'
					}
				);
			},
			singleValue: () => ({
				'maxWidth': 'auto',
				'position': 'relative',
				'top': 0,
				'transform': 'none',
				'display': 'flex',
				'flexDirection': vertical ? 'column' : 'row',
				'alignItems': 'center',
				color,
				'&:hover': {
					color: colorHover
				}
			}),
			valueContainer: () => ({
				overflow: 'visible',
				display: 'flex'
			}),
			menuList: () => ({
				backgroundColor: '#ffffff'
			}),
			option: (base, state) => ({
				...base,
				whiteSpace: 'nowrap',
				fontSize: '14px',
				color: '#3f373f',
				backgroundColor: state.isFocused ? '#f5f5f5' : '#ffffff'
			})
		},
		onMenuOpen,
		onMenuClose
	};

	return (
		<div
			className={`localeSwitch ${
				vertical ? 'localeSwitch--vertical' : ''
			}`}
		>
			<LanguageSelectDropdown {...languageSelectDropdown} />
		</div>
	);
};
