import * as React from 'react';
import {
	PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import {
	NavGlobeIcon,
	NavGlobeIconHover,
	NavGlobeIconFilled
} from './navigationSidebarIcons';
import { ReactComponent as NavDoorOpenIcon } from '../../resources/img/icons/navigation/door_open_400.svg';
import { ReactComponent as NavDoorOpenIconFilled } from '../../resources/img/icons/navigation/door_open_filled.svg';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	ConsultingTypesContext,
	SessionsDataContext,
	SET_SESSIONS,
	TenantContext,
	LocaleContext
} from '../../globalState';
import { initNavigationHandler } from './navigationHandler';
import { ReactComponent as LogoutIconOutline } from '../../resources/img/icons/logout_outline.svg';
import { ReactComponent as LogoutIconFilled } from '../../resources/img/icons/logout_filled.svg';
import clsx from 'clsx';
import { apiGetAskerSessionList } from '../../api';
import { useTranslation } from 'react-i18next';
import { LocaleSwitch } from '../localeSwitch/LocaleSwitch';
import { userHasBudibaseTools } from '../../api/apiGetTools';
import { browserNotificationsSettings } from '../../utils/notificationHelpers';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { useResponsive } from '../../hooks/useResponsive';
import { MENUPLACEMENT_RIGHT } from '../select/SelectDropdown';
import {
	useLiveChatAvailable,
	setLiveChatAvailable
} from '../../utils/liveChatToggle';
import { apiSetLiveChatAvailability } from '../../api/apiSetLiveChatAvailability';
import {
	LiveChatToggleInactiveIcon,
	LiveChatToggleActiveIcon
} from './LiveChatToggleIcons';

export interface NavigationBarProps {
	onLogout: any;
	routerConfig: any;
}

const REGEX_DASH = /\//g;
const stripLocalePrefix = (label: string) =>
	label.replace(/^\([^)]+\)\s*/, '');
const getFigmaRailLabel = (to: string, label: string) => {
	const figmaLabels: Record<string, string> = {
		'/sessions/consultant/sessionPreview': 'Anfra-\ngen',
		'/sessions/consultant/sessionView': 'Gesprä-\nche',
		'/notifications': 'Zeit-\nstrahl',
		'/profile': 'Mein\nProfil'
	};

	return figmaLabels[to] || label;
};

export const NavigationBar = ({
	onLogout,
	routerConfig
}: NavigationBarProps) => {
	const { t: translate } = useTranslation();
	const isFirstVisit = useIsFirstVisit();
	const { userData } = useContext(UserDataContext);
	const { consultingTypes } = useContext(ConsultingTypesContext);
	const { sessions, dispatch } = useContext(SessionsDataContext);
	const { selectableLocales, locale: activeLocale } =
		useContext(LocaleContext);
	const { fromL } = useResponsive();
	const [hasTools, setHasTools] = useState<boolean>(false);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const [liveChatAvailable] = useLiveChatAvailable();

	/*
	 * Resync persisted Live Chat availability to the backend after login/reload.
	 * The flag lives in localStorage, so on a fresh session (or after a backend
	 * restart) the server doesn't yet know this consultant is available. Re-assert
	 * it so the anonymous availability count is correct without a manual re-toggle.
	 */
	useEffect(() => {
		if (isConsultant && liveChatAvailable) {
			void apiSetLiveChatAvailability(true);
		}
	}, [isConsultant, liveChatAvailable]);
	const { tenant } = useContext(TenantContext);

	const ref_menu = useRef<any[]>([]);
	const ref_local = useRef<any>(null);
	const ref_logout = useRef<any>(null);
	const ref_select = useRef<any>(null);
	const ref_live_chat = useRef<any>(null);

	const handleLogout = useCallback(() => {
		onLogout();
	}, [onLogout]);

	const location = useLocation();
	const history = useHistory();

	/**
	 * Toggle live-chat availability. When turning ON we push the consultant
	 * to the Anfragen (sessionPreview) tab with `?chip=liveChat` so they
	 * land on the anonymous enquiry queue with the filter already active.
	 * `sessionPreview` is the enquiries list; `sessionView` is Gespräch —
	 * the intent here is enquiries.
	 */
	const handleLiveChatToggle = useCallback(() => {
		const nextActive = !liveChatAvailable;
		setLiveChatAvailable(nextActive);
		if (nextActive) {
			history.push('/sessions/consultant/sessionPreview?chip=liveChat');
		}
	}, [liveChatAvailable, history]);

	const figmaConsultantNav = true;
	/**
	 * Live-chat toggle is a consultant-only availability switch. It no longer
	 * links to the video-conference page; it simply flips a stored flag that
	 * controls whether anonymous enquiries appear in the consultant's list.
	 */
	const showLiveChatNav = isConsultant && fromL;
	const [animateNavIcon, setAnimateNavIcon] = useState(false);
	const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);
	const [isLanguageSelected, setIsLanguageSelected] = useState(false);
	const [isLogoutSelected, setIsLogoutSelected] = useState(false);
	const isLanguageHovered = hoveredNavItem === '__language__';
	const isLogoutHovered = hoveredNavItem === '__logout__';

	useEffect(() => {
		initNavigationHandler();
	}, []);

	useEffect(() => {
		if (!isConsultant) {
			apiGetAskerSessionList().then((sessionsData) => {
				dispatch({
					type: SET_SESSIONS,
					ready: true,
					sessions: sessionsData.sessions
				});
			});
		}
	}, [dispatch, isConsultant]);

	useEffect(() => {
		if (tenant?.settings?.featureToolsEnabled && !isConsultant) {
			userHasBudibaseTools(userData.userId).then((resp) =>
				setHasTools(resp)
			);
		}
	}, [tenant, userData, isConsultant]);

	const animateNavIconTimeoutRef = useRef(null);
	useEffect(() => {
		if (animateNavIconTimeoutRef.current) {
			return;
		}

		if (isFirstVisit && !browserNotificationsSettings().visited) {
			setAnimateNavIcon(true);
		}

		animateNavIconTimeoutRef.current = setTimeout(() => {
			setAnimateNavIcon(false);
			animateNavIconTimeoutRef.current = null;
		}, 1000);
	}, [isFirstVisit]);

	const pathsToShowUnreadMessageNotification = {
		'/profile':
			isFirstVisit && !browserNotificationsSettings().visited ? 1 : 0
	};

	const pathToClassNameInWalkThrough = React.useCallback((to: string) => {
		const value = to.replace(REGEX_DASH, '-').toLowerCase().slice(1);
		return value ? `walkthrough-${value}` : '';
	}, []);

	const handleSelection = (index) => {
		if (document.activeElement === ref_logout.current) {
			handleLogout();
		} else if (document.activeElement === ref_local.current) {
			ref_select.current.focus();
		} else {
			ref_menu.current[index].click();
		}
	};

	const handleArrowUp = (index) => {
		if (index === 0) {
			ref_logout.current.focus();
			ref_logout.current.setAttribute('tabindex', '0');
			ref_menu.current[index].setAttribute('tabindex', '-1');
		} else if (document.activeElement === ref_logout.current) {
			if (selectableLocales.length > 1) {
				ref_local.current.focus();
				ref_local.current.setAttribute('tabindex', '0');
				ref_logout.current.setAttribute('tabindex', '-1');
			} else {
				ref_menu.current[ref_menu.current.length - 1].focus();
				ref_menu.current[ref_menu.current.length - 1].setAttribute(
					'tabindex',
					'0'
				);
				ref_logout.current.setAttribute('tabindex', '-1');
			}
		} else if (document.activeElement === ref_local.current) {
			ref_menu.current[ref_menu.current.length - 1].focus();
			ref_menu.current[ref_menu.current.length - 1].setAttribute(
				'tabindex',
				'0'
			);
			ref_local.current.setAttribute('tabindex', '-1');
		} else if (
			document.activeElement !==
			document.getElementById('react-select-2-input')
		) {
			ref_menu.current[index - 1].focus();
			ref_menu.current[index - 1].setAttribute('tabindex', '0');
			ref_menu.current[index].setAttribute('tabindex', '-1');
		}
	};

	const handleArrowDown = (index) => {
		if (index === ref_menu.current.length - 1) {
			if (selectableLocales.length > 1) {
				ref_local.current.focus();
				ref_local.current.setAttribute('tabindex', '0');
				ref_menu.current[index].setAttribute('tabindex', '-1');
			} else {
				ref_logout.current.focus();
				ref_logout.current.setAttribute('tabindex', '0');
				ref_menu.current[index].setAttribute('tabindex', '-1');
			}
		} else if (document.activeElement === ref_local.current) {
			ref_logout.current.focus();
			ref_logout.current.setAttribute('tabindex', '0');
			ref_local.current.setAttribute('tabindex', '-1');
		} else if (document.activeElement === ref_logout.current) {
			ref_menu.current[0].focus();
			ref_menu.current[0].setAttribute('tabindex', '0');
			ref_logout.current.setAttribute('tabindex', '-1');
		} else if (
			document.activeElement !==
			document.getElementById('react-select-2-input')
		) {
			ref_menu.current[index + 1].focus();
			ref_menu.current[index + 1].setAttribute('tabindex', '0');
			ref_menu.current[index].setAttribute('tabindex', '-1');
		}
	};

	const handleKeyDownMenu = (e, index) => {
		switch (e.key) {
			case 'Enter':
			case ' ':
				handleSelection(index);
				break;
			case 'ArrowUp':
				handleArrowUp(index);
				break;
			case 'ArrowDown':
				handleArrowDown(index);
				break;
		}
	};

	return (
		<div
			className={clsx(
				'navigation__wrapper',
				figmaConsultantNav && 'navigation__wrapper--figma-consultant'
			)}
		>
			<div className="navigation__itemContainer" role="tablist">
				<NavGroup className="navigation__item__top">
					{sessions &&
						routerConfig.navigation
							.filter(
								(item: any) =>
									!item.condition ||
									item.condition(
										userData,
										consultingTypes,
										sessions,
										hasTools
									)
							)
							.map((item, index) => {
								const Icon = item?.icon;
								const IconHover = item?.iconHover;
								const IconFilled = item?.iconFilled;
								const dualIcon = Boolean(IconFilled);
								const useFigmaSlot =
									figmaConsultantNav && item.navSlot;
								const isActive =
									location.pathname.indexOf(item.to) !== -1;
								const isHovered = hoveredNavItem === item.to;
								const unreadCount = Number(
									pathsToShowUnreadMessageNotification[
										item.to
									] || 0
								);
								const showUnreadNav =
									Object.keys(
										pathsToShowUnreadMessageNotification
									).includes(item.to) && unreadCount > 0;
								const label = translate(item.titleKeys.large);
								const visibleLabel = useFigmaSlot
									? getFigmaRailLabel(item.to, label)
									: label;
								const isChatNav =
									item.to ===
										'/sessions/consultant/sessionView' ||
									item.to === '/sessions/user/view';
								const FigmaStateIcon = isActive
									? IconFilled || Icon
									: isHovered
										? IconHover || Icon
										: Icon;
								const iconBlock = useFigmaSlot ? (
									FigmaStateIcon ? (
										<FigmaStateIcon
											title={label}
											aria-label={label}
											className={clsx(
												'navigation__icon__single',
												isChatNav &&
													'navigation__icon__single--chat-figma',
												item.to === '/profile' &&
													'navigation__icon__single--profile-figma'
											)}
										/>
									) : null
								) : dualIcon ? (
									<>
										{Icon && (
												<Icon
													title={label}
													aria-label={label}
													className="navigation__icon__outline"
												/>
											)}
											{IconFilled && (
												<IconFilled
													title={label}
													aria-label={label}
													className="navigation__icon__filled"
												/>
											)}
									</>
								) : (
									Icon && (
										<Icon
											title={label}
											aria-label={label}
											className={clsx(
												'navigation__icon__single',
												useFigmaSlot &&
													isChatNav &&
													'navigation__icon__single--chat-figma',
												item.to === '/profile' &&
													useFigmaSlot &&
													'navigation__icon__single--profile-figma'
											)}
										/>
									)
								);
								return (
									<Link
										key={index}
										className={clsx(
											'navigation__item',
											pathToClassNameInWalkThrough(
												item.to
											),
											isActive &&
												'navigation__item--active',
											animateNavIcon &&
												Object.keys(
													pathsToShowUnreadMessageNotification
												).includes(item.to) &&
												'navigation__item__count--active',
											useFigmaSlot &&
												`navigation__item--nav-${item.navSlot}`
										)}
										to={item.to}
										aria-label={label}
										onMouseEnter={() =>
											setHoveredNavItem(item.to)
										}
										onMouseLeave={() =>
											setHoveredNavItem(null)
										}
										onFocus={() =>
											setHoveredNavItem(item.to)
										}
										onBlur={() => setHoveredNavItem(null)}
										onKeyDown={(e) =>
											handleKeyDownMenu(e, index)
										}
										ref={(el) => {
											ref_menu.current[index] = el;
										}}
										tabIndex={index === 0 ? 0 : -1}
										role="tab"
									>
										{useFigmaSlot ? (
											<div
												className={clsx(
													'navigation__icon-slot',
													`navigation__icon-slot--${item.navSlot}`,
													isActive &&
														'navigation__icon-slot--active'
												)}
											>
												<div className="navigation__icon-slot__inner">
													{iconBlock}
												</div>
												{showUnreadNav && (
													<NavigationUnreadIndicator
														animate={animateNavIcon}
														count={unreadCount}
														variant="figma"
													/>
												)}
											</div>
										) : (
											<div className="navigation__icon__background">
												{iconBlock}
											</div>
										)}
										<span
											className={clsx(
												'navigation__title',
												figmaConsultantNav &&
													'navigation__title--figma'
											)}
										>
											{visibleLabel}
										</span>
										{!useFigmaSlot && showUnreadNav && (
											<NavigationUnreadIndicator
												animate={animateNavIcon}
												count={unreadCount}
												variant="default"
											/>
										)}
									</Link>
								);
							})}
				</NavGroup>
				<NavGroup
					className={clsx('navigation__item__bottom', {
						'navigation__item__bottom--consultant':
							hasUserAuthority(
								AUTHORITIES.CONSULTANT_DEFAULT,
								userData
							)
					})}
				>
					{showLiveChatNav && (
						<button
							type="button"
							className={clsx(
								'navigation__item',
								'navigation__item--nav-live',
								'navigation__item--liveChatToggle',
								liveChatAvailable && 'navigation__item--active'
							)}
							ref={ref_live_chat}
							tabIndex={-1}
							role="switch"
							aria-checked={liveChatAvailable}
							aria-label={translate(
								liveChatAvailable
									? 'navigation.liveChatToggleActive'
									: 'navigation.liveChatToggleInactive'
							)}
							onClick={handleLiveChatToggle}
						>
							<div
								className={clsx(
									'navigation__icon-slot',
									'navigation__icon-slot--live',
									liveChatAvailable &&
										'navigation__icon-slot--active'
								)}
							>
								<div className="navigation__icon-slot__inner">
									{liveChatAvailable ? (
										<LiveChatToggleActiveIcon
											className="navigation__liveChatToggleIcon navigation__liveChatToggleIcon--active"
											aria-label={translate(
												'navigation.liveChatToggleActive'
											)}
										/>
									) : (
										<LiveChatToggleInactiveIcon
											className="navigation__liveChatToggleIcon"
											aria-label={translate(
												'navigation.liveChatToggleInactive'
											)}
										/>
									)}
								</div>
							</div>
							<span
								className={clsx(
									'navigation__title',
									'navigation__title--figma'
								)}
							>
								{translate('navigation.liveChat')}
							</span>
						</button>
					)}
					{selectableLocales.length > 1 && (
						<div
							className={clsx(
								'navigation__item',
								'navigation__item__language',
								figmaConsultantNav &&
									'navigation__item--nav-language'
							)}
							role="tab"
							tabIndex={-1}
							ref={(el) => {
								ref_local.current = el;
							}}
							onKeyDown={(e) => handleKeyDownMenu(e, null)}
							onMouseEnter={() =>
								setHoveredNavItem('__language__')
							}
							onMouseLeave={() => setHoveredNavItem(null)}
							onFocus={() => {
								setHoveredNavItem('__language__');
							}}
							onBlur={() => {
								setHoveredNavItem(null);
							}}
							id="local-switch-wrapper"
						>
							{figmaConsultantNav ? (
								<div
									className={clsx(
										'navigation__icon-slot navigation__icon-slot--row navigation__icon-slot--language',
										isLanguageSelected &&
											'navigation__icon-slot--active'
									)}
								>
									<div className="navigation__icon-slot__inner">
										<LocaleSwitch
											showIcon={true}
											iconOnly={true}
											updateUserData
											vertical
											iconSize={24}
											label={translate(
												'navigation.language'
											)}
											menuPlacement={MENUPLACEMENT_RIGHT}
											color="currentColor"
											colorHover="currentColor"
											selectRef={(el) =>
												(ref_select.current = el)
											}
											isInsideMenu={true}
											onMenuOpen={() =>
												setIsLanguageSelected(true)
											}
											onMenuClose={() =>
												setIsLanguageSelected(false)
											}
											leadingIconOverride={
												isLanguageSelected ? (
													<NavGlobeIconFilled className="navigation__globe-svg" />
												) : isLanguageHovered ? (
													<NavGlobeIconHover className="navigation__globe-svg" />
												) : (
													<NavGlobeIcon className="navigation__globe-svg" />
												)
											}
										/>
									</div>
								</div>
							) : (
								<LocaleSwitch
									showIcon={true}
									iconOnly={true}
									updateUserData
									vertical
									iconSize={24}
									label={translate('navigation.language')}
									menuPlacement={MENUPLACEMENT_RIGHT}
									selectRef={(el) =>
										(ref_select.current = el)
									}
									isInsideMenu={true}
								/>
							)}
							{figmaConsultantNav && (
								<span className="navigation__title navigation__title--figma">
									{stripLocalePrefix(
										translate([activeLocale, activeLocale], {
											ns: 'languages'
										})
									)}
								</span>
							)}
						</div>
					)}
					<div
						onClick={handleLogout}
						className={clsx(
							'navigation__item',
							figmaConsultantNav && 'navigation__item--nav-logout'
						)}
						role="tab"
						tabIndex={-1}
						ref={(el) => {
							ref_logout.current = el;
						}}
						onKeyDown={(e) => handleKeyDownMenu(e, null)}
						onMouseEnter={() => setHoveredNavItem('__logout__')}
						onMouseLeave={() => setHoveredNavItem(null)}
						onFocus={() => {
							setHoveredNavItem('__logout__');
							setIsLogoutSelected(true);
						}}
						onBlur={() => {
							setHoveredNavItem(null);
							setIsLogoutSelected(false);
						}}
					>
						{figmaConsultantNav ? (
							<>
								<div
									className={clsx(
										'navigation__icon-slot',
										'navigation__icon-slot--logout',
										isLogoutHovered &&
											'navigation__icon-slot--active'
									)}
								>
									<div className="navigation__icon-slot__inner">
										{isLogoutSelected ? (
											<NavDoorOpenIconFilled
												className="navigation__icon__single"
												aria-label={translate(
													'app.logout'
												)}
											/>
										) : isLogoutHovered ? (
											<NavDoorOpenIcon
												className="navigation__icon__single"
												aria-label={translate(
													'app.logout'
												)}
											/>
										) : (
											<NavDoorOpenIcon
												className="navigation__icon__single"
												aria-label={translate(
													'app.logout'
												)}
											/>
										)}
									</div>
								</div>
								<span className="navigation__title navigation__title--figma">
									{translate('app.logout')}
								</span>
							</>
						) : (
							<>
								<LogoutIconOutline
									className="navigation__icon__outline"
									title={translate('app.logout')}
									aria-label={translate('app.logout')}
								/>
								<LogoutIconFilled
									className="navigation__icon__filled"
									title={translate('app.logout')}
									aria-label={translate('app.logout')}
								/>
								<span className="navigation__title">
									{translate('app.logout')}
								</span>
							</>
						)}
					</div>
				</NavGroup>
			</div>
		</div>
	);
};

const NavGroup = ({
	children,
	className
}: PropsWithChildren<{ className: string }>) => {
	const { fromL } = useResponsive();
	if (fromL) {
		return <div className={className}>{children}</div>;
	}

	return <>{children}</>;
};

const NavigationUnreadIndicator = ({
	animate,
	count,
	variant = 'default'
}: {
	animate: boolean;
	count: number;
	variant?: 'default' | 'figma';
}) => {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		// After first render wait for initial animation
		setTimeout(() => {
			setVisible(true);
		}, 1000);
	}, []);

	const display = count > 99 ? '99+' : String(count);
	const isFigma = variant === 'figma';

	return (
		<span
			className={clsx(
				'navigation__item__count',
				!visible && 'navigation__item__count--initial',
				visible && animate && 'navigation__item__count--reanimate',
				count > 9 && 'navigation__item__count--double',
				isFigma && 'navigation__item__count--figma'
			)}
			aria-label={`${count} unread`}
		>
			{isFigma ? (
				<span className="navigation__item__count__sup">{display}</span>
			) : (
				display
			)}
		</span>
	);
};
