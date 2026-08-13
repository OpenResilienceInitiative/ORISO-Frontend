import * as React from 'react';
import { Children, ReactElement, ReactNode, useContext } from 'react';
import { Text } from '../text/Text';
import './StageLayout.styles.scss';
import clsx from 'clsx';
import { AgencySpecificContext, LocaleContext } from '../../globalState';
import { useTranslation } from 'react-i18next';
import { LocaleSwitchPill } from '../localeSwitch/LocaleSwitchPill';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import LegalLinks from '../legalLinks/LegalLinks';
import { LegalLinkButton } from '../legalLinks/LegalLinkButton';
import { StageMobileHero } from './StageMobileHero';
import {
	Box,
	Button as MuiButton,
	IconButton,
	SvgIcon,
	Typography,
	useScrollTrigger
} from '@mui/material';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { InfoDrawer } from '../registration/infoDrawer/InfoDrawer';
import { registrationMotion } from '../registration/registrationDesign/registrationDesign';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';
import { toSameOriginRoute } from './stageLayoutRoutes';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import { getPlatformVersion } from '../../resources/scripts/runtimeConfig';

interface StageLayoutProps {
	className?: string;
	children: ReactNode;
	stage: ReactNode;
	showLegalLinks?: boolean;
	showLoginLink?: boolean;
	showRegistrationLink?: boolean;
	loginParams?: string;
	registrationUrl?: string;
	showRegistrationInfoDrawer?: boolean;
}

export const StageLayout = ({
	className,
	children,
	stage,
	showLegalLinks,
	showLoginLink,
	showRegistrationLink,
	loginParams,
	registrationUrl,
	showRegistrationInfoDrawer
}: StageLayoutProps) => {
	const trigger = useScrollTrigger();
	const { t: translate } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);
	const { selectableLocales } = useContext(LocaleContext);
	const { specificAgency } = useContext(AgencySpecificContext);
	// v7 removed __RouterContext; useInRouterContext() answers the same question
	// (is a Router mounted?) used below to pick <RouterLink> vs a plain anchor.
	const routerContext = useInRouterContext();
	const settings = useAppConfig();
	const loginUrl = `${settings.urls.toLogin}${
		loginParams ? `?${loginParams}` : ''
	}`;
	const loginRoute = toSameOriginRoute(loginUrl);
	const resolvedRegistrationUrl =
		registrationUrl || settings.urls.toRegistration;
	const registrationRoute = toSameOriginRoute(resolvedRegistrationUrl);
	const registrationHref = registrationRoute || resolvedRegistrationUrl;
	const platformVersion = getPlatformVersion();

	return (
		<div className={clsx('stageLayout', className)}>
			<StageMobileHero
				action={
					showLoginLink && (
						<IconButton
							{...(loginRoute && routerContext
								? {
										component: RouterLink,
										to: loginRoute
									}
								: { href: loginRoute || loginUrl })}
							color="inherit"
							aria-label={translate('registration.login.label')}
							sx={{ color: 'var(--m3-on-primary, #fff)' }}
						>
							<LoginDoorIcon color="inherit" />
						</IconButton>
					)
				}
			/>

			{showRegistrationInfoDrawer && (
				<InfoDrawer trigger={trigger}></InfoDrawer>
			)}

			{React.cloneElement(Children.only(stage) as ReactElement<any>, {
				className: 'stageLayout__stage'
			})}

			<Box className="stageLayout__contentWrapper">
				<Box
					className={`stageLayout__header`}
					sx={{
						// Below $fromXLarge the header content lives in the
						// mobile hero, so the row only exists from there up.
						// This theme remaps MUI's breakpoints (md is 600, not
						// 900) — `lg` is the 1200px the hero hides at. Using
						// `md` here put both language controls and both CTAs on
						// screen at once across the whole tablet range.
						'display': { xs: 'none', lg: 'flex' },
						'height': { xs: 'auto', lg: '72px' },
						'minHeight': { xs: '48px', lg: '72px' },
						'py': { xs: 1, lg: 1.5 },
						'animation': `registrationHeaderEnter ${registrationMotion.standard} ${registrationMotion.easeOut} both`,
						'@keyframes registrationHeaderEnter': {
							'0%': {
								opacity: 0,
								transform: 'translateY(-16px)'
							},
							'100%': {
								opacity: 1,
								transform: 'translateY(0)'
							}
						},
						'@media (prefers-reduced-motion: reduce)': {
							animation: 'none'
						}
					}}
				>
					{selectableLocales.length > 1 && (
						<Box sx={{ display: { xs: 'none', lg: 'block' } }}>
							<LocaleSwitchPill />
						</Box>
					)}
					{showLoginLink && (
						<Box
							className="stageLayout__toLogin"
							sx={{ display: { xs: 'none', lg: 'block' } }}
						>
							<MuiButton
								className="stageLayout__toLogin__button"
								{...(loginRoute && routerContext
									? {
											component: RouterLink,
											to: loginRoute
										}
									: {
											component: 'a',
											href: loginRoute || loginUrl
										})}
								variant="outlined"
								startIcon={<LoginDoorIcon />}
								sx={{
									'minHeight': '48px',
									'minWidth': '148px',
									'borderRadius': '999px',
									'px': 2.75,
									'py': 1,
									'fontSize': '16px',
									'fontWeight': 700,
									'lineHeight': 1.2,
									'textTransform': 'none',
									'color': 'var(--m3-on-surface, #1b1b1c)',
									'borderColor':
										'var(--m3-outline-variant, #c4c7c8)',
									'backgroundColor':
										'rgba(255, 255, 255, 0.92)',
									'&:hover': {
										color: 'var(--m3-on-secondary, #ffffff)',
										borderColor:
											'var(--m3-secondary, #4c555f)',
										backgroundColor:
											'var(--m3-secondary, #4c555f)'
									},
									'&&:active, &&:active:hover': {
										'color':
											'var(--m3-on-primary, #ffffff)',
										'WebkitTextFillColor':
											'var(--m3-on-primary, #ffffff)',
										'borderColor':
											'var(--m3-primary, #a4262e)',
										'backgroundColor':
											'var(--m3-primary, #a4262e)',
										'& .MuiButton-startIcon, & .MuiButton-endIcon':
											{
												color: 'var(--m3-on-primary, #ffffff)'
											}
									}
								}}
							>
								{translate('registration.login.label')}
							</MuiButton>
						</Box>
					)}

					{showRegistrationLink && (
						<Box
							className="login__tenantRegistration"
							sx={{
								gap: { xs: 1, sm: 1.5 },
								justifyContent: 'flex-end',
								width: '100%'
							}}
						>
							<Typography
								variant="body2"
								sx={{
									display: { xs: 'none', sm: 'block' },
									color: 'var(--m3-on-surface-variant, #4f565d)',
									fontWeight: 600,
									lineHeight: 1.2,
									whiteSpace: 'nowrap'
								}}
							>
								{translate('login.register.infoText.short')}
							</Typography>
							<MuiButton
								className="login__tenantRegistrationLink"
								{...(registrationRoute && routerContext
									? {
											component: RouterLink,
											to: registrationRoute
										}
									: {
											component: 'a',
											href: registrationHref
										})}
								variant="contained"
								disableElevation
								startIcon={<CenterFocusStrongRoundedIcon />}
								sx={registrationHeaderButtonSx}
							>
								{translate('login.register.linkLabel')}
							</MuiButton>
						</Box>
					)}
				</Box>

				<Box
					sx={{
						// The hero is in flow, so mobile no longer needs an
						// offset for a fixed app bar — only the registration
						// info drawer still overlays the top of the sheet.
						mt: {
							xs: showRegistrationInfoDrawer ? '96px' : 0,
							md: '0'
						}
					}}
					className="stageLayout__content"
				>
					{children}
				</Box>

				{(showLegalLinks || platformVersion) && (
					<div className="stageLayout__footer">
						{showLegalLinks && (
							<div className={`stageLayout__legalLinks`}>
								<LegalLinks
									delimiter={
										<Text
											type="infoSmall"
											className="stageLayout__legalLinksSeparator"
											text=" | "
										/>
									}
									params={{ aid: specificAgency?.id }}
									legalLinks={legalLinks}
								>
									{(label, url, rawLabel) => (
										<LegalLinkButton
											label={label}
											rawLabel={rawLabel}
											url={url}
											textClassName="stageLayout__legalLinksItem"
										/>
									)}
								</LegalLinks>
							</div>
						)}
						{platformVersion && (
							<Text
								className="stageLayout__platformVersion"
								type="infoSmall"
								text={platformVersion}
							/>
						)}
					</div>
				)}
			</Box>
		</div>
	);
};

/**
 * Registration is the onboarding path, so it carries the strongest CTA on the
 * screen (design 2d): a filled primary button, not the outlined variant it
 * used to be.
 */
const registrationHeaderButtonSx = {
	'minHeight': '48px',
	'borderRadius': '999px',
	'px': { xs: 2, md: 2.75 },
	'py': 1,
	'fontSize': { xs: '14px', md: '16px' },
	'fontWeight': 700,
	'lineHeight': 1.2,
	'textTransform': 'none',
	'color': 'var(--m3-on-primary, #ffffff)',
	'backgroundColor': 'var(--m3-primary, #a5000a)',
	'boxShadow': 'none',
	'transition':
		'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
	'& .MuiButton-startIcon': {
		color: 'inherit',
		mr: 0.75
	},
	'&:hover': {
		color: 'var(--m3-on-primary, #ffffff)',
		backgroundColor: 'var(--m3-primary-hover, #820006)',
		boxShadow: '0 10px 26px rgba(165, 0, 10, 0.18)',
		transform: 'translateY(-1px)'
	},
	'&&:active, &&:active:hover': {
		color: 'var(--m3-on-primary, #ffffff)',
		WebkitTextFillColor: 'var(--m3-on-primary, #ffffff)',
		backgroundColor: 'var(--m3-primary-hover, #820006)',
		boxShadow: 'none',
		transform: 'translateY(0)'
	},
	'&:focus-visible': {
		outline: '2px solid var(--m3-primary-outline, #930008)',
		outlineOffset: '2px'
	}
} as const;

const LoginDoorIcon = (props: SvgIconProps) => (
	<SvgIcon {...props} viewBox="0 0 24 24">
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M1.99958 4.99976C1.99958 3.3432 3.34303 1.99976 4.99958 1.99976H13.0002C14.6568 1.99976 16.0002 3.3432 16.0002 4.99976V6.49976H13.9996V4.99976C13.9996 4.44756 13.5524 4.00037 13.0002 4.00037H8.83958L11.6005 5.85476C12.494 6.45476 13.0002 7.48976 13.0002 8.56124V16.0003C13.5524 16.0003 13.9996 15.5521 13.9996 15V13.5H16.0002V15C16.0002 16.6565 14.6568 18 13.0002 18V18.7978C13.0002 19.9996 12.3955 21.0168 11.503 21.5671C10.6012 22.1231 9.41522 22.1868 8.39887 21.5043L3.39919 18.1453C2.50668 17.5453 1.99951 16.5103 1.99951 15.4388L1.99958 4.99976ZM4.0002 5.20226C4.0002 4.68664 4.25052 4.31819 4.54675 4.13538C4.83269 3.95913 5.1683 3.9432 5.4852 4.15601L10.4849 7.51505C10.7811 7.7138 10.9996 8.10099 10.9996 8.56131V18.7978C10.9996 19.3134 10.7492 19.6819 10.453 19.8647C10.1671 20.0409 9.83146 20.0568 9.51456 19.844L4.51488 16.485C4.21862 16.2862 4.0002 15.8991 4.0002 15.4387V5.20226Z"
		/>
		<path d="M14.2931 10.7072C13.9022 10.3162 13.9022 9.68344 14.2931 9.2925L17.2931 6.2925C17.6831 5.9025 18.3169 5.9025 18.7069 6.2925C19.0978 6.68344 19.0978 7.31624 18.7069 7.70718L17.4141 8.99999H20.9999C21.5521 8.99999 22.0002 9.44812 22.0002 10.0003C22.0002 10.5525 21.5521 10.9997 20.9999 10.9997H17.4141L18.7069 12.2925C19.0978 12.6834 19.0978 13.3162 18.7069 13.7072C18.3169 14.0972 17.6831 14.0972 17.2931 13.7072L14.2931 10.7072Z" />
	</SvgIcon>
);
