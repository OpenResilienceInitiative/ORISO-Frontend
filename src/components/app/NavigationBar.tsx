import * as React from 'react';
import {
	PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import {
	MENUPLACEMENT_RIGHT,
	MENUPLACEMENT_TOP
} from '../select/SelectDropdown';
import {
	useLiveChatAvailable,
	useLiveChatAvailabilityHeartbeat,
	useLiveChatViaSidebar
} from '../../utils/liveChatToggle';
import { useNotifStatusViaSidebar } from '../../utils/notificationStatusToggle';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { ReactComponent as NotifStatusOnIcon } from '../../resources/img/icons/notification_bell.svg';
import { ReactComponent as NotifStatusOffIcon } from '../../resources/img/icons/bell-off.svg';
import {
	LiveChatToggleActiveIcon,
	LiveChatToggleInactiveIcon
} from './LiveChatToggleIcons';

export interface NavigationBarProps {
	onLogout: any;
	routerConfig: any;
}

const REGEX_DASH = /\//g;
const stripLocalePrefix = (label: string) => label.replace(/^\([^)]+\)\s*/, '');
const hyphenateRailLabel = (label: string, breakAfter: number) => {
	if (/\s/.test(label)) {
		return label.replace(/\s+/, '\n');
	}
	if (label.length <= breakAfter + 3) {
		return label;
	}
	return `${label.slice(0, breakAfter)}-\n${label.slice(breakAfter)}`;
};
const getFigmaRailLabel = (to: string, label: string) => {
	const compactLabel = stripLocalePrefix(label.trim());
	const railBreaks: Record<string, number> = {
		'/sessions/consultant/sessionPreview': 5,
		'/sessions/consultant/sessionView': 6,
		'/notifications': 4
	};

	if (to === '/profile') {
		return compactLabel.replace(/\s+/, '\n');
	}

	const breakAfter = railBreaks[to];
	return breakAfter
		? hyphenateRailLabel(compactLabel, breakAfter)
		: compactLabel;
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
	const [
		liveChatAvailable,
		setLiveChatAvailable,
		{
			loading: liveChatLoading,
			pending: liveChatPending,
			error: liveChatError
		}
	] = useLiveChatAvailable();
	const [liveChatViaSidebar] = useLiveChatViaSidebar();
	// #576: optional global notification-status button in the rail — flips the
	// account-wide mute (the one switch that overrides everything). Placement
	// is opt-in from the settings page, like the Live Chat rail toggle.
	const [notifStatusViaSidebar] = useNotifStatusViaSidebar();
	const { settings: notifSettings, updateSettings: updateNotifSettings } =
		useNotificationSettings();
	const notifMuted = notifSettings.globalMute;
	useLiveChatAvailabilityHeartbeat(isConsultant, liveChatAvailable);
	const { tenant } = useContext(TenantContext);

	const ref_menu = useRef<any[]>([]);
	const ref_local = useRef<any>(null);
	const ref_logout = useRef<any>(null);
	const ref_select = useRef<any>(null);

	const handleLogout = useCallback(() => {
		onLogout();
	}, [onLogout]);

	const location = useLocation();
	const navigate = useNavigate();

	/**
	 * Rail Live Chat toggle (only shown when the consultant opted into
	 * "control from the menu bar" in My-Profile). Flips availability; on
	 * turning ON we push to the anonymous enquiry queue with the filter active,
	 * matching the original 1.0 behaviour. The rail icon stays visible in both
	 * states — only its active/inactive styling changes.
	 */
	const handleLiveChatToggle = useCallback(async () => {
		const nextActive = !liveChatAvailable;
		try {
			await setLiveChatAvailable(nextActive);
			if (nextActive) {
				navigate('/sessions/consultant/sessionPreview?chip=liveChat');
			}
		} catch {
			// The hook retains the acknowledged state and exposes a localized error.
		}
	}, [liveChatAvailable, navigate, setLiveChatAvailable]);

	const figmaConsultantNav = true;
	/**
	 * Live Chat rail toggle:
	 * - Desktop: only when the consultant opted into "control from the menu
	 *   bar" in My Profile (Frank / viaSidebar preference).
	 * - Mobile/tablet: always for consultants so Live Chat stays reachable in
	 *   the scrollable bottom bar without hunting through Profile.
	 */
	const showLiveChatNav = isConsultant && (liveChatViaSidebar || !fromL);
	const languageMenuPlacement = fromL
		? MENUPLACEMENT_RIGHT
		: MENUPLACEMENT_TOP;
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
								// Desktop rail may hyphenate/wrap; mobile bottom bar
								// must stay single-line to avoid overlapping neighbors.
								const visibleLabel = useFigmaSlot
									? fromL
										? getFigmaRailLabel(item.to, label)
										: stripLocalePrefix(label.trim())
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
					{notifStatusViaSidebar && (
						<button
							type="button"
							className={clsx(
								'navigation__item',
								'navigation__item--notifStatus',
								notifMuted && 'navigation__item--muted'
							)}
							tabIndex={0}
							role="switch"
							aria-checked={!notifMuted}
							aria-label={translate(
								notifMuted
									? 'profile.notifications.config.statusButton.muted'
									: 'profile.notifications.config.statusButton.active'
							)}
							title={translate(
								notifMuted
									? 'profile.notifications.config.statusButton.muted'
									: 'profile.notifications.config.statusButton.active'
							)}
							onClick={() =>
								updateNotifSettings({
									globalMute: !notifMuted
								})
							}
							data-cy="nav-notif-status"
						>
							<div className="navigation__icon-slot">
								<div className="navigation__icon-slot__inner">
									{notifMuted ? (
										<NotifStatusOffIcon
											className="navigation__notifStatusIcon navigation__notifStatusIcon--muted"
											aria-hidden
										/>
									) : (
										<NotifStatusOnIcon
											className="navigation__notifStatusIcon"
											aria-hidden
										/>
									)}
								</div>
							</div>
						</button>
					)}
					{showLiveChatNav && (
						<button
							type="button"
							className={clsx(
								'navigation__item',
								'navigation__item--nav-live',
								'navigation__item--liveChatToggle',
								liveChatAvailable && 'navigation__item--active'
							)}
							tabIndex={0}
							role="switch"
							data-tour-target="livechat-availability-toggle"
							aria-checked={liveChatAvailable}
							aria-label={translate(
								liveChatAvailable
									? 'navigation.liveChatToggleActive'
									: 'navigation.liveChatToggleInactive'
							)}
							aria-busy={liveChatPending}
							disabled={liveChatLoading || liveChatPending}
							title={
								liveChatError
									? translate(
											'error.statusCodes.500.description'
										)
									: undefined
							}
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
											aria-hidden
										/>
									) : (
										<LiveChatToggleInactiveIcon
											className="navigation__liveChatToggleIcon"
											aria-hidden
										/>
									)}
								</div>
							</div>
							<span className="navigation__title navigation__title--figma">
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
											menuPlacement={
												languageMenuPlacement
											}
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
									menuPlacement={languageMenuPlacement}
									selectRef={(el) =>
										(ref_select.current = el)
									}
									isInsideMenu={true}
								/>
							)}
							{figmaConsultantNav && (
								<span className="navigation__title navigation__title--figma">
									{stripLocalePrefix(
										translate(
											[activeLocale, activeLocale],
											{
												ns: 'languages'
											}
										)
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
	return <div className={className}>{children}</div>;
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
