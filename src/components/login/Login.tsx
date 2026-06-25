import '../../polyfill';
import * as React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
	InputField,
	InputFieldItem,
	InputFieldLabelState
} from '../inputField/InputField';
import { endpoints } from '../../resources/scripts/endpoints';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { autoLogin, redirectToApp } from '../registration/autoLogin';
import {
	clearAuthSession,
	CONSULTANT_LOGIN_BLOCKED_ERROR,
	consumeConsultantLoginBlocked,
	isConsultantAccessToken
} from '../auth/consultantLoginBlock';
import { Text } from '../text/Text';
import { ReactComponent as PersonIcon } from '../../resources/img/icons/person.svg';
import { ReactComponent as LockIcon } from '../../resources/img/icons/lock.svg';
import { ReactComponent as VerifiedIcon } from '../../resources/img/icons/verified.svg';
import { StageLayout } from '../stageLayout/StageLayout';
import { apiGetUserData, FETCH_ERRORS } from '../../api';
import { OTP_LENGTH, TWO_FACTOR_TYPES } from '../twoFactorAuth/TwoFactorAuth';
import clsx from 'clsx';
import {
	AUTHORITIES,
	hasUserAuthority,
	RocketChatGlobalSettingsContext,
	TenantContext,
	UserDataContext,
	LocaleContext
} from '../../globalState';
import { UserDataInterface } from '../../globalState/interfaces';
import '../../resources/styles/styles';
import './login.styles';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { VALIDITY_INVALID } from '../registration/registrationHelpers';
import { TwoFactorAuthResendMail } from '../twoFactorAuth/TwoFactorAuthResendMail';
import {
	IBooleanSetting,
	SETTING_E2E_ENABLE
} from '../../api/apiRocketChatSettingsPublic';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	deleteCookieByName,
	getValueFromCookie,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { apiRequestMagicLinkLogin } from '../../api/apiRequestMagicLinkLogin';
import { apiConsumeMagicLinkLogin } from '../../api/apiConsumeMagicLinkLogin';
import { useSearchParam } from '../../hooks/useSearchParams';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { budibaseLogout } from '../budibase/budibaseLogout';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { setTokens } from '../auth/auth';

const regexAccountDeletedError = /account disabled/i;

export const Login = () => {
	type LoginMethod = 'password' | 'magicLink';
	const settings = useAppConfig();
	const { t: translate } = useTranslation();

	const { locale, initLocale } = useContext(LocaleContext);
	const { tenant } = useContext(TenantContext);
	const { getSetting } = useContext(RocketChatGlobalSettingsContext);
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { Stage } = useContext(GlobalComponentContext);
	const gcid = useSearchParam<string>('gcid');
	const magicToken = useSearchParam<string>('magicToken');
	const isFirstVisit = useIsFirstVisit();

	const loginButton: ButtonItem = {
		label: translate('login.button.label'),
		type: BUTTON_TYPES.PRIMARY
	};

	const hasTenant = tenant != null;

	const { consultant, loaded: isReady } = useContext(UrlParamsContext);
	const [labelState, setLabelState] = useState<InputFieldLabelState>(null);
	const [activeLoginMethod] = useState<LoginMethod>('password');
	const [username, setUsername] = useState<string>('');
	const [password, setPassword] = useState<string>('');
	const [magicLinkUsername, setMagicLinkUsername] = useState<string>('');
	const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(
		username.length > 0 && password.length > 0
	);
	const [otp, setOtp] = useState<string>('');
	const [isOtpRequired, setIsOtpRequired] = useState<boolean>(false);
	const [showLoginError, setShowLoginError] = useState<string>('');
	const [showMagicLinkError, setShowMagicLinkError] = useState<string>('');
	const [magicLinkSentToUsername, setMagicLinkSentToUsername] =
		useState<string>('');
	const [isRequestInProgress, setIsRequestInProgress] =
		useState<boolean>(false);
	const [isMagicTokenLoginAttempted, setIsMagicTokenLoginAttempted] =
		useState<boolean>(false);
	const { featureToolsEnabled } = getTenantSettings();

	useEffect(() => {
		// If we're authenticated and have a gcid, redirect to app
		if (gcid && getValueFromCookie('keycloak')) {
			apiGetUserData([FETCH_ERRORS.CATCH_ALL])
				.then(() => redirectToApp(gcid))
				.catch(() => null); // do nothing
		}
	}, [consultant, gcid, reloadUserData, userData]);

	useEffect(() => {
		setShowLoginError('');
		setShowMagicLinkError('');
		setLabelState(null);
		if (
			(!isOtpRequired && username && password) ||
			(isOtpRequired && username && password && otp)
		) {
			setIsButtonDisabled(false);
		} else {
			setIsButtonDisabled(true);
		}
	}, [username, password, otp, isOtpRequired]);

	useEffect(() => {
		setOtp('');
		setIsOtpRequired(false);
	}, [username]);

	useEffect(() => {
		if (!gcid && featureToolsEnabled) {
			budibaseLogout().catch(() => null);
		}
	}, [featureToolsEnabled, gcid]);

	const [pwResetOverlayActive, setPwResetOverlayActive] = useState(false);
	const [twoFactorType, setTwoFactorType] = useState(TWO_FACTOR_TYPES.NONE);

	const inputItemUsername: InputFieldItem = {
		name: 'username',
		class: 'login',
		id: 'username',
		type: 'text',
		label: translate('login.user.label'),
		content: username,
		icon: <PersonIcon />,
		...(labelState && { labelState })
	};

	const inputItemMagicLinkUsername: InputFieldItem = {
		name: 'magicLinkUsername',
		class: 'login',
		id: 'magicLinkUsername',
		type: 'text',
		label: translate('login.magicLink.usernameLabel'),
		content: magicLinkUsername,
		icon: <PersonIcon />
	};

	const inputItemPassword: InputFieldItem = {
		name: 'password',
		id: 'passwordInput',
		type: 'password',
		label: translate('login.password.label'),
		content: password,
		icon: <LockIcon />,
		...(labelState && { labelState })
	};

	const otpInputItem: InputFieldItem = {
		content: otp,
		id: 'otp',
		infoText:
			twoFactorType === TWO_FACTOR_TYPES.APP
				? translate(`login.warning.failed.app.otp.missing`)
				: '',
		label: translate('twoFactorAuth.activate.otp.input.label.text'),
		name: 'otp',
		type: 'text',
		icon: <VerifiedIcon />,
		maxLength: OTP_LENGTH,
		tabIndex: isOtpRequired ? 0 : -1
	};

	const handleUsernameChange = (event) => {
		setUsername(event.target.value);
		setShowMagicLinkError('');
		setMagicLinkSentToUsername('');
	};

	const handlePasswordChange = (event) => {
		setPassword(event.target.value);
	};

	const handleMagicLinkUsernameChange = (event) => {
		setMagicLinkUsername(event.target.value);
		setShowMagicLinkError('');
		setMagicLinkSentToUsername('');
	};

	const handleOtpChange = (event) => {
		setOtp(event.target.value);
	};

	const handlePwOverlayReset = useCallback(
		(buttonFunction: string) => {
			if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT) {
				setValueInCookie(
					'KEYCLOAK_LOCALE',
					locale,
					endpoints.loginResetPasswordLink
						.split('/')
						.slice(0, -1)
						.join('/')
				);
				window.open(
					endpoints.loginResetPasswordLink,
					'_self',
					'noreferrer'
				);
			} else if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
				setPwResetOverlayActive(false);
			}
		},
		[locale]
	);

	const showConsultantLoginBlockedError = useCallback(() => {
		setShowLoginError(translate('login.warning.failed.consultantBlocked'));
		setLabelState(VALIDITY_INVALID);
	}, [translate]);

	useEffect(() => {
		if (consumeConsultantLoginBlocked()) {
			showConsultantLoginBlockedError();
		}
	}, [showConsultantLoginBlockedError]);

	useEffect(() => {
		deleteCookieByName('tenantId');
	}, []);

	const postLogin = useCallback(
		() =>
			reloadUserData().then(async (userData: UserDataInterface) => {
				// If user has changed language from default but the profile has different language in profile override it
				let patchedUserData = {};
				if (
					userData.preferredLanguage !== locale &&
					locale !== initLocale
				) {
					patchedUserData['preferredLanguage'] = locale;
				}

				if (
					hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
				) {
					clearAuthSession();
					showConsultantLoginBlockedError();
					throw new Error(CONSULTANT_LOGIN_BLOCKED_ERROR);
				}

				if (Object.keys(patchedUserData).length > 0) {
					await apiPatchUserData(patchedUserData).catch((error) => {
						/* console.log(error); */
					});
					await reloadUserData().catch((error) => {
						/* console.log(error); */
					});
				}

				if (
					!consultant ||
					!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)
				) {
					return redirectToApp(gcid);
				}
			}),
		[
			reloadUserData,
			locale,
			initLocale,
			consultant,
			gcid,
			showConsultantLoginBlockedError
		]
	);

	useEffect(() => {
		if (!magicToken || isMagicTokenLoginAttempted) {
			return;
		}

		setIsMagicTokenLoginAttempted(true);
		setIsRequestInProgress(true);
		setShowLoginError('');
		setShowMagicLinkError('');

		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('magicToken');
		window.history.replaceState(
			{},
			document.title,
			currentUrl.pathname + currentUrl.search + currentUrl.hash
		);

		apiConsumeMagicLinkLogin(magicToken)
			.then((tokenResponse) => {
				if (isConsultantAccessToken(tokenResponse.access_token)) {
					throw new Error(CONSULTANT_LOGIN_BLOCKED_ERROR);
				}

				setTokens(
					tokenResponse.access_token,
					tokenResponse.expires_in,
					tokenResponse.refresh_token,
					tokenResponse.refresh_expires_in
				);
				// Magic-token login is complete once tokens are set.
				// Continue directly into authenticated app bootstrap.
				return postLogin();
			})
			.catch((error) => {
				if (error?.message === CONSULTANT_LOGIN_BLOCKED_ERROR) {
					showConsultantLoginBlockedError();
				} else {
					setShowLoginError(
						translate('login.warning.failed.unauthorized.text')
					);
				}
			})
			.finally(() => {
				setIsRequestInProgress(false);
			});
	}, [
		magicToken,
		isMagicTokenLoginAttempted,
		postLogin,
		translate,
		gcid,
		showConsultantLoginBlockedError
	]);

	const tryLogin = (otp?: string) => {
		setIsRequestInProgress(true);
		autoLogin({
			username: username,
			password: password,
			tenantData: tenant,
			...(otp ? { otp } : {})
		})
			.then(postLogin)
			.catch((error) => {
				if (error.message === FETCH_ERRORS.UNAUTHORIZED) {
					setShowLoginError(
						translate(
							otp
								? 'login.warning.failed.unauthorized.otp'
								: 'login.warning.failed.unauthorized.text'
						)
					);
					setLabelState(VALIDITY_INVALID);
				} else if (!otp && error.message === FETCH_ERRORS.BAD_REQUEST) {
					if (
						error.options?.data?.error_description?.match(
							regexAccountDeletedError
						)
					) {
						setShowLoginError(
							translate('login.warning.failed.deletedAccount')
						);
						setLabelState(VALIDITY_INVALID);
					} else if (error.options?.data?.otpType) {
						setTwoFactorType(error.options.data.otpType);
						setIsOtpRequired(true);
					}
				} else if (error?.message === CONSULTANT_LOGIN_BLOCKED_ERROR) {
					showConsultantLoginBlockedError();
				}

				setIsRequestInProgress(false);
			});
	};

	const handleLogin = () => {
		if (
			isRequestInProgress ||
			!username ||
			!password ||
			(isOtpRequired && !otp)
		) {
			return;
		}
		tryLogin(otp);
	};

	const handleMagicLinkLogin = async () => {
		const normalizedUsername = magicLinkUsername?.trim().toLowerCase();
		if (!normalizedUsername) {
			setShowMagicLinkError(
				translate('login.magicLink.usernameRequired')
			);
			return;
		}
		if (isRequestInProgress) {
			return;
		}
		setIsRequestInProgress(true);
		setShowMagicLinkError('');
		try {
			await apiRequestMagicLinkLogin(normalizedUsername);
			setValueInCookie(
				'KEYCLOAK_LOCALE',
				locale,
				endpoints.loginResetPasswordLink
					.split('/')
					.slice(0, -1)
					.join('/')
			);
			setMagicLinkSentToUsername(normalizedUsername);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === FETCH_ERRORS.FORBIDDEN
			) {
				setShowMagicLinkError(translate('login.magicLink.notEnabled'));
			} else {
				setShowMagicLinkError(
					translate('login.warning.failed.unauthorized.text')
				);
			}
		} finally {
			setIsRequestInProgress(false);
		}
	};

	const handleKeyUp = (e) => {
		if (e.key === 'Enter') {
			if (activeLoginMethod === 'magicLink') {
				handleMagicLinkLogin();
				return;
			}
			handleLogin();
		}
	};

	const pwResetOverlay: OverlayItem = useMemo(
		() => ({
			headline: translate('login.password.reset.warn.overlay.title'),
			copy: translate('login.password.reset.warn.overlay.description'),
			buttonSet: [
				{
					label: translate(
						'login.password.reset.warn.overlay.button.accept'
					),
					function: OVERLAY_FUNCTIONS.REDIRECT,
					type: BUTTON_TYPES.SECONDARY
				},
				{
					label: translate(
						'login.password.reset.warn.overlay.button.cancel'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[translate]
	);

	const onPasswordResetClick = (e) => {
		if (getSetting<IBooleanSetting>(SETTING_E2E_ENABLE)?.value) {
			e.preventDefault();
			setPwResetOverlayActive(true);
			return;
		}
		setValueInCookie(
			'KEYCLOAK_LOCALE',
			locale,
			endpoints.loginResetPasswordLink.split('/').slice(0, -1).join('/')
		);
		window.open(endpoints.loginResetPasswordLink, '_self', 'noreferrer');
	};

	return (
		<>
			<StageLayout
				stage={<Stage hasAnimation={isFirstVisit} isReady={isReady} />}
				showLegalLinks
				showRegistrationLink={hasTenant}
			>
				<div className="loginForm">
					<div className="loginForm__inner">
						<div className="loginForm__headline">
							<h2>{translate('login.headline')}</h2>
						</div>
						{/* <div className="loginForm__tabs">
							<button
								type="button"
								className={clsx('loginForm__tab', {
									'loginForm__tab--active':
										activeLoginMethod === 'password'
								})}
								onClick={() => {
									setActiveLoginMethod('password');
									setShowMagicLinkError('');
									setMagicLinkSentToUsername('');
								}}
							>
								{translate('login.tabs.password')}
							</button>
							<button
								type="button"
								className={clsx('loginForm__tab', {
									'loginForm__tab--active':
										activeLoginMethod === 'magicLink'
								})}
								onClick={() => {
									setActiveLoginMethod('magicLink');
									setShowLoginError('');
									setMagicLinkSentToUsername('');
								}}
							>
								{translate('login.tabs.magicLink')}
							</button>
						</div> */}

						<div className="loginForm__fields">
							{activeLoginMethod === 'magicLink' &&
							magicLinkSentToUsername ? (
								<Text
									className="loginForm__magicLinkInfo"
									text={translate(
										'login.magicLink.sentInfo',
										{
											username: magicLinkSentToUsername
										}
									)}
									type="infoSmall"
								/>
							) : (
								<InputField
									item={
										activeLoginMethod === 'password'
											? inputItemUsername
											: inputItemMagicLinkUsername
									}
									inputHandle={
										activeLoginMethod === 'password'
											? handleUsernameChange
											: handleMagicLinkUsernameChange
									}
									keyUpHandle={handleKeyUp}
								/>
							)}
							{activeLoginMethod === 'password' && (
								<>
									<InputField
										item={inputItemPassword}
										inputHandle={handlePasswordChange}
										keyUpHandle={handleKeyUp}
									/>
									<div
										className={clsx('loginForm__otp', {
											'loginForm__otp--active':
												isOtpRequired
										})}
									>
										{twoFactorType ===
											TWO_FACTOR_TYPES.EMAIL && (
											<Text
												className="loginForm__emailHint"
												text={translate(
													'twoFactorAuth.activate.email.resend.hint'
												)}
												type="infoLargeAlternative"
											/>
										)}
										<InputField
											item={otpInputItem}
											inputHandle={handleOtpChange}
											keyUpHandle={handleKeyUp}
										/>
										{twoFactorType ===
											TWO_FACTOR_TYPES.EMAIL && (
											<TwoFactorAuthResendMail
												resendHandler={(callback) => {
													tryLogin();
													callback();
												}}
											/>
										)}
									</div>
								</>
							)}
						</div>

						{showLoginError && (
							<Text
								text={showLoginError}
								type="infoSmall"
								className="loginForm__error"
							/>
						)}
						{showMagicLinkError && (
							<Text
								text={showMagicLinkError}
								type="infoSmall"
								className="loginForm__error"
							/>
						)}

						<div className="loginForm__actions">
							<Button
								item={{
									...loginButton,
									label:
										activeLoginMethod === 'password'
											? translate('login.button.label')
											: translate(
													'login.magicLink.submitLabel'
												)
								}}
								buttonHandle={
									activeLoginMethod === 'password'
										? handleLogin
										: handleMagicLinkLogin
								}
								disabled={
									activeLoginMethod === 'password'
										? isButtonDisabled ||
											isRequestInProgress
										: !magicLinkUsername?.trim() ||
											isRequestInProgress
								}
							/>

							{activeLoginMethod === 'password' &&
								!(twoFactorType === TWO_FACTOR_TYPES.EMAIL) && (
									<button
										onClick={onPasswordResetClick}
										className="button-as-link"
										type="button"
									>
										{translate('login.resetPasswort.label')}
									</button>
								)}
						</div>

						{!hasTenant && (
							<div className="loginForm__register">
								<div className="loginForm__register__separator">
									<span>{translate('login.seperator')}</span>
								</div>
								<div className="loginForm__register__content">
									<Text
										text={translate(
											'login.register.infoText.title'
										)}
										type={'infoMedium'}
									/>
									<button
										onClick={() =>
											window.open(
												settings.urls.toRegistration,
												'_self'
											)
										}
										className="button-as-link consulting-topics"
										type="button"
									>
										{translate('login.register.linkLabel')}
									</button>
								</div>
							</div>
						)}

						<div className="loginForm__securityBanner">
							<div className="security-header">
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M12 2L3 7V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V7L12 2Z"
										stroke="#10b981"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										fill="none"
									/>
									<path
										d="M9 12L11 14L15 10"
										stroke="#10b981"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>
							<span>
								{translate('login.security.description')}
							</span>
						</div>
					</div>
				</div>
			</StageLayout>
			{pwResetOverlayActive && (
				<Overlay
					item={pwResetOverlay}
					handleOverlayClose={() => setPwResetOverlayActive(false)}
					handleOverlay={handlePwOverlayReset}
				/>
			)}
		</>
	);
};
