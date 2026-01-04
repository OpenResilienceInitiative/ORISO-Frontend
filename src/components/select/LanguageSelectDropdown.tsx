import clsx from 'clsx';
import * as React from 'react';
import Select, { defaultStyles, MenuPlacement } from 'react-select';
import { components } from 'react-select';
import { CloseCircle } from '../../resources/img/icons';
import { ReactComponent as ArrowDownIcon } from '../../resources/img/icons/arrow-down-light.svg';
import { ReactComponent as ArrowUpIcon } from '../../resources/img/icons/arrow-up-light.svg';
import { Text } from '../text/Text';
import './select2.react.styles';
import './select2.styles';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { ReactNode, useMemo, useRef, useEffect } from 'react';

export interface SelectOption {
	value: string;
	label: ReactNode;
	iconLabel?: string;
	isFixed?: boolean;
}

export interface SelectOptionsMulti {
	action: string;
	name?: string;
	removedValue?: SelectOption;
	option?: SelectOption;
}

export const MENUPLACEMENT_TOP = 'top';
export const MENUPLACEMENT_BOTTOM = 'bottom';
export const MENUPLACEMENT_RIGHT = 'right';
export const MENUPLACEMENT_BOTTOM_LEFT = 'bottomLeft';

export type MENUPLACEMENT =
	| typeof MENUPLACEMENT_TOP
	| typeof MENUPLACEMENT_BOTTOM
	| typeof MENUPLACEMENT_RIGHT
	| typeof MENUPLACEMENT_BOTTOM_LEFT;

export interface SelectDropdownItem {
	className?: string;
	id: string;
	selectedOptions: SelectOption[];
	selectInputLabel?: string;
	placeholder?: string;
	handleDropdownSelect: Function;
	useIconOption?: boolean;
	isSearchable?: boolean;
	isMulti?: boolean;
	isClearable?: boolean;
	menuPlacement: MENUPLACEMENT;
	menuPosition?: 'absolute' | 'fixed';
	defaultValue?: SelectOption | SelectOption[];
	hasError?: boolean;
	errorMessage?: string;
	onKeyDown?: Function;
	styleOverrides?: defaultStyles;
	selectRef?: any;
	isInsideMenu?: boolean;
	menuShouldBlockScroll?: boolean;
}

const colourStyles = (
	fromL,
	menuPlacement: MENUPLACEMENT,
	{
		control,
		singleValue,
		input,
		option,
		menuList,
		menu,
		multiValue,
		multiValueLabel,
		multiValueRemove,
		indicatorSeparator,
		valueContainer,
		...overrides
	}: defaultStyles
) => ({
	control: (styles, state) => {
		const isMulti = state.selectProps.isMulti;
		return {
			...styles,
			'backgroundColor': 'white',
			'border': state.isFocused
				? '2px solid #3F373F'
				: '1px solid #8C878C',
			'borderRadius': undefined,
			// ✅ FIXED BIG BOX for multi-select (like textarea)
			'minHeight': isMulti ? '200px' : '50px',
			'height': isMulti ? '200px' : '50px', // FIXED 200px height (not flexible!)
			'maxHeight': isMulti ? '200px' : '50px',
			'overflowY': 'visible',
			'outline': '0',
			'padding': state.isFocused ? '0 11px' : '0 12px',
			'color': '#3F373F',
			'boxShadow': undefined,
			'cursor': 'pointer',
			'&:hover': {
				border: state.isFocused
					? '2px solid #3F373F'
					: '1px solid #3F373F',
				padding: state.isFocused ? '0 11px' : '0 12px'
			},
			'.language-select__inputLabel': {
				fontSize: state.isFocused || state.hasValue ? '12px' : '16px',
				top: state.isFocused || state.hasValue ? '0px' : '14px',
				transition: 'font-size .5s, top .5s',
				color: 'rgba(0, 0, 0, 0.6)',
				position: 'absolute',
				marginLeft: '3px',
				cursor: 'pointer'
			},
			...(control?.(styles, state) ?? {})
		};
	},
	singleValue: (styles, state) => ({
		...styles,
		top: '60%',
		...(singleValue?.(styles, state) ?? {})
	}),
	input: (styles, state) => {
		const isMulti = state.selectProps.isMulti;
		return isMulti
			? {
					...styles,
					...(input?.(styles, state) ?? {})
				}
			: {
					...styles,
					paddingTop: '12px',
					cursor: 'pointer',
					...(input?.(styles, state) ?? {})
				};
	},
	valueContainer: (styles, state) => {
		const isMulti = state.selectProps.isMulti;
		return {
			...styles,
			// ✅ FIXED BIG BOX - valueContainer fills the 200px control
			flexWrap: isMulti ? 'wrap' : 'nowrap',
			height: isMulti ? '170px' : 'auto', // Fixed height to fill control
			maxHeight: isMulti ? '170px' : 'none',
			overflowY: isMulti ? 'auto' : 'visible',
			padding: isMulti ? '24px 8px 8px 8px' : '8px', // ✅ Extra top padding for label
			alignContent: 'flex-start', // Align pills to top
			...(valueContainer?.(styles, state) ?? {})
		};
	},
	option: (styles, state) => {
		return {
			...styles,

			// Use values from stylesheet
			color: undefined,
			backgroundColor: undefined,

			textAlign: 'left',
			lineHeight: '21px',
			cursor: 'pointer',
			...(option?.(styles, state) ?? {})
		};
	},
	menuList: (styles, state) => ({
		...styles,
		...(!fromL && { maxHeight: '150px' }),
		padding: '0',
		border: undefined,
		borderRadius: '4px',
		boxShadow: undefined,
		...(menuList?.(styles, state) ?? {})
	}),
	menu: (styles, state) => ({
		...styles,
		'marginTop': state.menuPlacement === MENUPLACEMENT_TOP ? '0' : '16px',
		'fontWeight': 'normal',
		...(menuPlacement === MENUPLACEMENT_RIGHT
			? {
					top: '0', // Align with top of button
					left: '100%', // Position to the right of button
					bottom: 'auto',
					marginLeft: '16px',
					marginTop: 0,
					width: 'auto'
				}
			: {
					marginBottom:
						state.menuPlacement === MENUPLACEMENT_TOP
							? '16px'
							: '0',
					right:
						menuPlacement === MENUPLACEMENT_BOTTOM_LEFT ? 0 : 'auto'
				}),
		'boxShadow': undefined,
		'&:after, &:before': {
			content: `''`,
			position: 'absolute',
			marginTop: '-1px',
			marginLeft: '-12px',
			zIndex: 2,
			...(menuPlacement === MENUPLACEMENT_RIGHT
				? {
						left: '0',
						top: 'var(--arrow-top, 50%)', // Align with button center (calculated dynamically)
						bottom: 'auto',
						transform: 'translateY(-50%)', // Center the arrow
						borderTop: '10px solid transparent',
						borderBottom: '10px solid transparent',
						borderLeft: 'none',
						borderRight: '10px solid #fff',
						height: '12px',
						width: '12px'
					}
				: {
						left:
							menuPlacement === MENUPLACEMENT_BOTTOM_LEFT
								? '75%'
								: '50%',
						bottom:
							state.menuPlacement === MENUPLACEMENT_TOP
								? '-9px'
								: 'auto',
						top:
							state.menuPlacement === MENUPLACEMENT_TOP
								? 'auto'
								: '-8px',
						borderLeft: '10px solid transparent',
						borderRight: '10px solid transparent',
						borderTop:
							state.menuPlacement === MENUPLACEMENT_TOP
								? '10px solid #fff'
								: 'none',
						borderBottom:
							state.menuPlacement === MENUPLACEMENT_TOP
								? 'none'
								: '10px solid #fff'
					})
		},
		'&:before': {
			zIndex: 1,
			...(menuPlacement === MENUPLACEMENT_RIGHT
				? {
						left: '0',
						top: '16px', // Position arrow at top of menu
						bottom: '5%',
						borderTop: '10px solid transparent',
						borderBottom: '10px solid transparent',
						borderLeft: 'none',
						borderRight: '10px solid rgba(0,0,0,0.1)'
					}
				: {
						bottom:
							state.menuPlacement === MENUPLACEMENT_TOP
								? '-14px'
								: 'auto',
						top:
							state.menuPlacement === MENUPLACEMENT_TOP
								? 'auto'
								: '-10px',
						borderTop:
							state.menuPlacement === MENUPLACEMENT_TOP
								? '10px solid rgba(0,0,0,0.1)'
								: 'none',
						borderBottom:
							state.menuPlacement === MENUPLACEMENT_TOP
								? 'none'
								: '10px solid rgba(0,0,0,0.1)'
					})
		},
		...(menu?.(styles, state) ?? {})
	}),
	multiValue: (styles, state) => {
		const common = {
			margin: '4px'
		};
		return state.data.isFixed
			? {
					...styles,
					...common,
					// important is needed for fixed option to overwrite color from scss
					'border': '1px solid rgba(0,0,0,0.2) !important',
					'backgroundColor': 'transparent !important',
					'&:hover': {
						'border': '1px solid rgba(0,0,0,0.2) !important',
						'backgroundColor': 'transparent !important',
						'& > .language-select__input__multi-value__label': {
							color: 'rgba(0,0,0,0.8) !important'
						}
					},
					...(multiValue?.(styles, state) ?? {})
				}
			: {
					...styles,
					...common,
					border: '1px solid transparent',
					...(multiValue?.(styles, state) ?? {})
				};
	},
	multiValueLabel: (styles, state) => {
		const common = {
			paddingLeft: '11px',
			paddingRight: '11px',
			paddingTop: '3px',
			paddingBottom: '3px'
		};
		return state.data.isFixed
			? {
					// important is needed for fixed option to overwrite color from scss
					...styles,
					...common,
					'color': 'rgba(0,0,0,0.8) !important',
					'&:hover': {
						color: 'rgba(0,0,0,0.8) !important'
					},
					'cursor': 'pointer',
					...(multiValueLabel?.(styles, state) ?? {})
				}
			: {
					...styles,
					...common,
					paddingRight: '4px',
					cursor: 'pointer',
					...(multiValueLabel?.(styles, state) ?? {})
				};
	},
	multiValueRemove: (styles, state) =>
		state.data.isFixed
			? {
					...styles,
					display: 'none',
					...(multiValueRemove?.(styles, state) ?? {})
				}
			: {
					...styles,
					'paddingRight': '8px',
					'cursor': 'pointer',
					'opacity': 1,
					'backgroundColor': 'transparent',
					'&:hover': {
						backgroundColor: 'transparent'
					},
					...(multiValueRemove?.(styles, state) ?? {})
				},
	indicatorSeparator: (styles, state) => ({
		...styles,
		display: 'none',
		cursor: 'pointer',
		...(indicatorSeparator?.(styles, state) ?? {})
	}),
	...overrides
});

export const LanguageSelectDropdown = (props: SelectDropdownItem) => {
	const { t: translate } = useTranslation();
	const { fromL } = useResponsive();

	const IconOption = (props) => (
		<components.Option {...props} className="language-select__option">
			<span className="language-select__option__icon">{props.data.iconLabel}</span>
			<p className="language-select__option__label">{props.data.label}</p>
		</components.Option>
	);

	const IconDropdown = (props) => (
		<components.DropdownIndicator {...props}>
			<span id="selectIcon" className="language-select__input__iconWrapper">
				{props.selectProps.menuIsOpen ? (
					<ArrowUpIcon
						title={translate('app.close')}
						aria-label={translate('app.close')}
						className="tertiary"
					/>
				) : (
					<ArrowDownIcon
						title={translate('app.open')}
						aria-label={translate('app.open')}
						className="tertiary"
					/>
				)}
			</span>
		</components.DropdownIndicator>
	);

	const currentSelectInputLabel = props.selectInputLabel;
	const CustomValueContainer = ({ children, ...props }) => (
		<components.ValueContainer {...props} className="language-select__inputWrapper">
			{React.Children.map(children, (child) => child)}
			<label className="language-select__inputLabel">
				{translate(currentSelectInputLabel)}
			</label>
		</components.ValueContainer>
	);

	const CustomMultiValueRemove = (props) => {
		return (
			<components.MultiValueRemove {...props}>
				<CloseCircle
					title={translate('app.delete')}
					aria-label={translate('app.delete')}
				/>
			</components.MultiValueRemove>
		);
	};

	const menuPlacement = useMemo<MenuPlacement>(() => {
		switch (props.menuPlacement) {
			case MENUPLACEMENT_BOTTOM_LEFT:
			case MENUPLACEMENT_RIGHT:
				return MENUPLACEMENT_BOTTOM;
			default:
				return props.menuPlacement;
		}
	}, [props.menuPlacement]);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const selectRef = useRef<any>(null);

	// Position menu to the right when MENUPLACEMENT_RIGHT is used
	useEffect(() => {
		if (props.menuPlacement === MENUPLACEMENT_RIGHT && wrapperRef.current) {
			const positionMenu = () => {
				const menu = document.querySelector('.language-select__input__menu') as HTMLElement;
				const wrapper = wrapperRef.current;
				if (menu && wrapper) {
					const control = wrapper.querySelector('.language-select__input__control') as HTMLElement;
					if (control) {
						const rect = control.getBoundingClientRect();
						menu.style.position = 'fixed';
						menu.style.left = `${rect.right + 16}px`;
						menu.style.top = `${rect.top}px`;
						menu.style.right = 'auto';
						menu.style.bottom = 'auto';
						menu.style.transform = 'none';
						menu.style.marginTop = '0';
						menu.style.marginLeft = '0';
					}
				}
			};

			// Use MutationObserver to watch for menu appearance
			const observer = new MutationObserver(() => {
				positionMenu();
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true
			});

			// Also try immediately
			setTimeout(positionMenu, 0);

			return () => observer.disconnect();
		}
	}, [props.menuPlacement]);

	return (
		<div ref={wrapperRef} className={clsx(props.className, 'language-select__wrapper')}>
			<Select
				id={props.id}
				className={`language-select__input ${
					props.hasError ? 'language-select__input--error' : ''
				}`}
				classNamePrefix="language-select__input"
				components={{
					Option: props.useIconOption
						? IconOption
						: components.Option,
					DropdownIndicator: IconDropdown,
					ValueContainer: props.selectInputLabel
						? CustomValueContainer
						: components.ValueContainer,
					IndicatorSeparator: !props.isSearchable
						? () => null
						: components.IndicatorSeparator,
					MultiValueRemove: CustomMultiValueRemove
				}}
				menuPortalTarget={props.menuPlacement === MENUPLACEMENT_RIGHT ? document.body : undefined}
				value={props.defaultValue ? props.defaultValue : null}
				defaultValue={props.defaultValue ? props.defaultValue : null}
				onChange={props.handleDropdownSelect}
				options={props.selectedOptions}
				noOptionsMessage={() => null}
				menuPosition={props.menuPosition}
				menuShouldBlockScroll={props.menuShouldBlockScroll}
				menuPlacement={menuPlacement}
				placeholder={props.placeholder ? props.placeholder : ''}
				isClearable={props.isClearable}
				isSearchable={props.isSearchable}
				isMulti={props.isMulti}
				styles={colourStyles(
					fromL,
					props.menuPlacement,
					props.styleOverrides ?? {}
				)}
				onKeyDown={(e) => (props.onKeyDown ? props.onKeyDown(e) : null)}
				tabIndex={props.isInsideMenu ? -1 : 0}
				ref={(ref) => {
					selectRef.current = ref;
					if (props.selectRef) {
						if (typeof props.selectRef === 'function') {
							props.selectRef(ref);
						} else {
							props.selectRef.current = ref;
						}
					}
				}}
				openMenuOnFocus={props.isInsideMenu ? true : false}
				onMenuOpen={() => {
					if (props.menuPlacement === MENUPLACEMENT_RIGHT) {
						setTimeout(() => {
							const menu = document.querySelector('.select__input__menu') as HTMLElement;
							const wrapper = wrapperRef.current;
							if (menu && wrapper) {
								const control = wrapper.querySelector('.select__input__control') as HTMLElement;
								if (control) {
									const rect = control.getBoundingClientRect();
									// Position menu slightly above the button (8px above)
									const topOffset = -8;
									const menuTop = rect.top + topOffset;
									const buttonCenter = rect.top + (rect.height / 2);
									
									menu.style.position = 'fixed';
									menu.style.left = `${rect.right + 16}px`;
									menu.style.top = `${menuTop}px`;
									menu.style.right = 'auto';
									menu.style.bottom = 'auto';
									menu.style.transform = 'none';
									menu.style.marginTop = '0';
									menu.style.marginLeft = '0';
									
									// Position arrow to align with button center
									const arrowOffset = buttonCenter - menuTop;
									const menuElement = menu as HTMLElement;
									if (menuElement) {
										menuElement.style.setProperty('--arrow-top', `${arrowOffset}px`);
									}
								}
							}
						}, 0);
					}
				}}
				closeMenuOnSelect={true}
				onMenuClose={() => {
					if (props.isInsideMenu) {
						setTimeout(() => {
							document
								.getElementById('local-switch-wrapper')
								.focus();
						}, 10); //we need this timeout because the menu is not closed when switching the focus
					}
				}}
			/>
			{props.hasError && (
				<div className="language-select__error">
					<Text text={props.errorMessage} type="infoSmall" />
				</div>
			)}
		</div>
	);
};
