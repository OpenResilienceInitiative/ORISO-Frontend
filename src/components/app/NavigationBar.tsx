import * as React from 'react';
import {
	PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppConfig } from '../../hooks/useAppConfig';
import { hasVideoCallFeature } from '../../utils/videoCallHelpers';
import {
	NavLiveChatIcon,
	NavGlobeIcon,
	NavLogoutIcon
} from './navigationSidebarIcons';
import {
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES,
	ConsultingTypesContext,
	SessionsDataContext,
	SET_SESSIONS,
	TenantContext,
	LocaleContext,
	NotificationsContext
} from '../../globalState';
import { initNavigationHandler } from './navigationHandler';
import { ReactComponent as LogoutIconOutline } from '../../resources/img/icons/logout_outline.svg';
import { ReactComponent as LogoutIconFilled } from '../../resources/img/icons/logout_filled.svg';
import clsx from 'clsx';
import { RocketChatUnreadContext } from '../../globalState/provider/RocketChatUnreadProvider';
import { apiGetAskerSessionList, apiGetUserDrafts } from '../../api';
import { useTranslation } from 'react-i18next';
import { LocaleSwitch } from '../localeSwitch/LocaleSwitch';
import { userHasBudibaseTools } from '../../api/apiGetTools';
import { browserNotificationsSettings } from '../../utils/notificationHelpers';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { useResponsive } from '../../hooks/useResponsive';
import { MENUPLACEMENT_RIGHT } from '../select/SelectDropdown';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';

export interface NavigationBarProps {
	onLogout: any;
	routerConfig: any;
}

const REGEX_DASH = /\//g;
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
	const settings = useAppConfig();
	const { fromL } = useResponsive();
	const [hasTools, setHasTools] = useState<boolean>(false);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const { sessions: unreadSessions, group: unreadGroup } = useContext(
		RocketChatUnreadContext
	);
	const { tenant } = useContext(TenantContext);
	const { unreadNotificationCount } = useContext(NotificationsContext);
	const [draftCount, setDraftCount] = useState(0);

	const ref_menu = useRef<any[]>([]);
	const ref_local = useRef<any>(null);
	const ref_logout = useRef<any>(null);
	const ref_select = useRef<any>(null);
	const ref_live_chat = useRef<any>(null);

	const handleLogout = useCallback(() => {
		onLogout();
	}, [onLogout]);

	const location = useLocation();

	const figmaConsultantNav = isConsultant && fromL;
	const videoConferencePath = settings?.urls?.consultantVideoConference;
	const showLiveChatNav =
		figmaConsultantNav &&
		videoConferencePath &&
		hasVideoCallFeature(userData, consultingTypes);
	const isVideoConferenceActive =
		showLiveChatNav &&
		(location.pathname === videoConferencePath ||
			location.pathname.startsWith(`${videoConferencePath}/`));
	const [animateNavIcon, setAnimateNavIcon] = useState(false);

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

	const loadDraftCount = useCallback(async () => {
		const response = await apiGetUserDrafts(0, 200).catch(() => null);
		const visibleDrafts =
			response?.items?.filter(
				(entry) => entry.scopeKey !== REMOTE_DRAFT_INDEX_SCOPE
			) || [];
		setDraftCount(visibleDrafts.length);
	}, []);

	useEffect(() => {
		void loadDraftCount();
	}, [loadDraftCount, location.pathname]);

	useEffect(() => {
		const onFocus = () => {
			void loadDraftCount();
		};
		window.addEventListener('focus', onFocus);
		const intervalId = window.setInterval(() => {
			void loadDraftCount();
		}, 20000);
		return () => {
			window.removeEventListener('focus', onFocus);
			window.clearInterval(intervalId);
		};
	}, [loadDraftCount]);

	const animateNavIconTimeoutRef = useRef(null);
	useEffect(() => {
		if (animateNavIconTimeoutRef.current) {
			return;
		}

		if (
			unreadSessions.length + unreadGroup.length > 0 ||
			unreadNotificationCount > 0 ||
			draftCount > 0
		) {
			setAnimateNavIcon(true);
		}

		animateNavIconTimeoutRef.current = setTimeout(() => {
			setAnimateNavIcon(false);
			animateNavIconTimeoutRef.current = null;
		}, 1000);
	}, [unreadSessions, unreadGroup, unreadNotificationCount, draftCount]);

	const pathsToShowUnreadMessageNotification = {
		'/sessions/consultant/sessionView':
			unreadSessions.length + unreadGroup.length,
		'/sessions/user/view': unreadSessions.length + unreadGroup.length,
		'/profile':
			isFirstVisit && !browserNotificationsSettings().visited ? 1 : 0,
		'/notifications': unreadNotificationCount,
		'/drafts': draftCount
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
								const IconFilled = item?.iconFilled;
								const dualIcon = Boolean(IconFilled);
								const useFigmaSlot =
									figmaConsultantNav && item.navSlot;
								const isActive =
									location.pathname.indexOf(item.to) !== -1;
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
								const iconBlock = dualIcon ? (
									<>
										{Icon && (
											<Icon
												title={label}
												aria-label={label}
												className={clsx(
													'navigation__icon__outline',
													{
														'navigation__icon--drafts':
															item.to ===
																'/drafts' &&
															!item.navSlot
													}
												)}
											/>
										)}
										{IconFilled && (
											<IconFilled
												title={label}
												aria-label={label}
												className={clsx(
													'navigation__icon__filled',
													{
														'navigation__icon--drafts':
															item.to ===
																'/drafts' &&
															!item.navSlot
													}
												)}
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
												item.to === '/drafts' &&
													useFigmaSlot &&
													'navigation__icon__single--drafts-figma'
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
											{label}
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
						<Link
							className={clsx(
								'navigation__item',
								'navigation__item--nav-live',
								isVideoConferenceActive &&
									'navigation__item--active'
							)}
							to={videoConferencePath}
							ref={ref_live_chat}
							tabIndex={-1}
							role="tab"
						>
							<div
								className={clsx(
									'navigation__icon-slot',
									'navigation__icon-slot--live',
									isVideoConferenceActive &&
										'navigation__icon-slot--active'
								)}
							>
								<div className="navigation__icon-slot__inner">
									<NavLiveChatIcon
										className="navigation__icon__single navigation__icon__single--on-dark"
										aria-label={translate(
											'navigation.liveChat'
										)}
									/>
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
						</Link>
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
							id="local-switch-wrapper"
						>
							{figmaConsultantNav ? (
								<div className="navigation__icon-slot navigation__icon-slot--row navigation__icon-slot--language">
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
											selectRef={(el) =>
												(ref_select.current = el)
											}
											isInsideMenu={true}
											leadingIconOverride={
												<NavGlobeIcon className="navigation__globe-svg" />
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
									{translate([activeLocale, activeLocale], {
										ns: 'languages'
									})}
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
					>
						{figmaConsultantNav ? (
							<>
								<div className="navigation__icon-slot navigation__icon-slot--logout">
									<div className="navigation__icon-slot__inner">
										<NavLogoutIcon
											className="navigation__icon__single"
											aria-label={translate('app.logout')}
										/>
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
				<sup className="navigation__item__count__sup">{display}</sup>
			) : (
				display
			)}
		</span>
	);
};
