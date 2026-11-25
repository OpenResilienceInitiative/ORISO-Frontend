import * as React from 'react';
import './localeSwitch.styles';
import { ReactComponent as LanguageIconOutline } from '../../resources/img/icons/language_outline.svg';
import { useTranslation } from 'react-i18next';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import { UserDataContext, LocaleContext } from '../../globalState';
import { markLocaleChosen } from '../../globalState/provider/LocaleProvider';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import {
	MENUPLACEMENT,
	MENUPLACEMENT_BOTTOM,
	MENUPLACEMENT_RIGHT,
	SelectDropdownItem
} from '../select/SelectDropdown';
import { LanguageSelectDropdown } from '../select/LanguageSelectDropdown';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import LanguageIcon from '@mui/icons-material/Language';

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
	inlineMenu?: boolean;
	color?: string;
	colorHover?: string;
	iconOnly?: boolean;
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
	inlineMenu = false,
	color = 'var(--m3-on-surface)',
	colorHover = 'var(--m3-primary-hover)',
	iconOnly,
	leadingIconOverride,
	onMenuOpen,
	onMenuClose
}) => {
	const { t: translate } = useTranslation(['common', 'languages']);

	const userDataContext = useContext(UserDataContext);
	const { locale, setLocale, selectableLocales } = useContext(LocaleContext);

	const requestInProgress = useRef(false);
	const [expanded, setExpanded] = useState(false);
	const inlineListId = useId();
	const inlineTriggerRef = useRef<HTMLButtonElement>(null);
	// The locale whose PATCH failed. userData keeps the old preferredLanguage
	// when the request fails, so the guard below stays true; without this the
	// effect would re-send forever. Cleared when the user picks another one.
	const rejectedLocale = useRef<string | null>(null);

	useEffect(() => {
		if (
			!updateUserData ||
			userDataContext?.userData?.preferredLanguage === locale ||
			requestInProgress.current ||
			rejectedLocale.current === locale
		) {
			return;
		}

		requestInProgress.current = true;
		apiPatchUserData({
			preferredLanguage: locale
		})
			.then(() => {
				rejectedLocale.current = null;
				return userDataContext.reloadUserData();
			})
			.catch(() => {
				// Give up on this locale. Accounts without a user or consultant
				// record answer 404 for every attempt (ORISO-Frontend#1595).
				rejectedLocale.current = locale;
			})
			.finally(() => {
				requestInProgress.current = false;
			});
	}, [locale, updateUserData, userDataContext]);

	if (selectableLocales.length <= 1) {
		return null;
	}

	const selectLocale = (value: string) => {
		// Requests triggered by the new locale must see the new cookie.
		setValueInCookie('lang', value);
		markLocaleChosen(value);
		setLocale(value);
	};

	const localeName = (value: string) =>
		translate([value, value], { ns: 'languages' }).replace(
			/^\([^)]+\)\s*/,
			''
		);

	if (inlineMenu) {
		return (
			<div
				className="localeSwitchInline"
				onKeyDown={(event) => {
					if (expanded && event.key === 'Escape') {
						event.stopPropagation();
						setExpanded(false);
						inlineTriggerRef.current?.focus();
					}
				}}
			>
				<button
					type="button"
					ref={inlineTriggerRef}
					className="localeSwitchInline__trigger"
					aria-label={`${translate('app.selectLanguage')}, ${localeName(locale)}`}
					aria-expanded={expanded}
					aria-controls={inlineListId}
					onClick={() => setExpanded(!expanded)}
				>
					<span className="localeSwitchInline__globe" aria-hidden>
						{leadingIconOverride ?? <LanguageIcon />}
					</span>
					<span>{localeName(locale)}</span>
					<ExpandMoreIcon
						className="localeSwitchInline__chevron"
						aria-hidden
					/>
				</button>
				<ul
					className="localeSwitchInline__languages"
					id={inlineListId}
					hidden={!expanded}
				>
					{selectableLocales.map((value) => (
						<li key={value}>
							<button
								type="button"
								aria-pressed={value === locale}
								onClick={() => {
									selectLocale(value);
									setExpanded(false);
									inlineTriggerRef.current?.focus();
								}}
							>
								<span>{localeName(value)}</span>
								{value === locale && <CheckIcon aria-hidden />}
							</button>
						</li>
					))}
				</ul>
			</div>
		);
	}

	const languageSelectDropdown: SelectDropdownItem = {
		handleDropdownSelect: ({ value }) => selectLocale(value),
		id: 'languageSelect',
		ariaLabel: translate('app.selectLanguage'),
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
				'width': iconOnly ? 'auto' : '100%',
				'backgroundColor': 'var(--m3-surface-container)',
				'&:before, &:after': { display: 'none' },
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
				backgroundColor: 'var(--m3-surface-container)'
			}),
			option: (base, state) => ({
				...base,
				whiteSpace: 'normal',
				fontSize: '14px',
				color:
					state.isFocused || state.isSelected
						? 'var(--m3-on-secondary-container)'
						: 'var(--m3-on-surface)',
				backgroundColor:
					state.isFocused || state.isSelected
						? 'var(--m3-secondary-container)'
						: 'var(--m3-surface-container)',
				boxShadow: state.isFocused
					? 'inset 0 0 0 2px var(--m3-on-secondary-container)'
					: 'none'
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
