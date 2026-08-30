import React, {
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	Box,
	Button,
	IconButton,
	InputAdornment,
	Typography
} from '@mui/material';
import { endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import {
	isRedeemInviteLinkSessionResponse,
	redeemInviteLink,
	RedeemInviteLinkLegacyResponse
} from '../../api/apiRedeemInviteLink';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { redirectToApp } from '../registration/autoLogin';
import {
	applyRedeemSessionCredentials,
	redirectToInviteSession
} from './inviteLinkHelpers';
import {
	mintInviteGuestCredentials,
	rerollInviteGuestUsername
} from './inviteLinkIdentity';
import { StageLayout } from '../stageLayout/StageLayout';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { OrisoTextField } from '../form/OrisoTextField';
import genDiceIcon from '../../resources/img/registration-md3/icons/gen-dice.svg';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import type { Pseudonym } from '../../utils/anonName/engine';

/**
 * Landing page for invite links.
 *
 * New topic-based links (External Inbounds): redeem creates an anonymous
 * session and returns tokens — user goes straight to the waiting room.
 *
 * Legacy agency links: redeem returns agency/consultingType; guest confirms a
 * rolled User-ID, then we register an asker and redirect into the app.
 */
export const InviteLink = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { token } = useParams<{ token: string; topicSlug?: string }>();
	const tenantContext = useContext(TenantContext);
	const localeContext = useContext(LocaleContext);
	const { Stage } = useContext(GlobalComponentContext);
	const tenant = tenantContext?.tenant;
	const locale = localeContext?.locale ?? 'de';
	const [status, setStatus] = useState<
		'loading' | 'identity' | 'registering' | 'error'
	>('loading');
	const [errorMessage, setErrorMessage] = useState('');
	const [legacyRedeem, setLegacyRedeem] =
		useState<RedeemInviteLinkLegacyResponse | null>(null);
	const [identity, setIdentity] = useState<Pseudonym | null>(null);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const hasRunRef = useRef(false);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setErrorMessage('Missing token');
			return;
		}
		if (hasRunRef.current) return;
		hasRunRef.current = true;

		(async () => {
			try {
				const data = await redeemInviteLink(token);

				if (isRedeemInviteLinkSessionResponse(data)) {
					applyRedeemSessionCredentials(data);
					redirectToInviteSession(data);
					return;
				}

				const minted = mintInviteGuestCredentials(locale);
				setLegacyRedeem(data);
				setIdentity(minted.identity);
				setUsername(minted.username);
				setPassword(minted.password);
				setStatus('identity');
			} catch (err: unknown) {
				setStatus('error');
				setErrorMessage(
					err instanceof Error
						? err.message
						: 'Invite link could not be used'
				);
			}
		})();
	}, [token, locale]);

	const handleReroll = useCallback(() => {
		if (!identity) return;
		const next = rerollInviteGuestUsername(identity, locale);
		setIdentity(next.identity);
		setUsername(next.username);
	}, [identity, locale]);

	const handleContinue = useCallback(async () => {
		if (!legacyRedeem || !username || !password) return;
		setStatus('registering');
		try {
			await apiPostRegistration(
				endpoints.registerAsker,
				{
					username,
					password,
					agencyId: String(legacyRedeem.agencyId),
					postcode: '00000',
					termsAccepted: 'true',
					preferredLanguage: locale,
					consultingType:
						legacyRedeem.consultingTypeId != null
							? String(legacyRedeem.consultingTypeId)
							: '0',
					...(legacyRedeem.topicId != null
						? { mainTopicId: String(legacyRedeem.topicId) }
						: {})
				} as any,
				false,
				tenant as any
			);
			redirectToApp(undefined, { navigate });
		} catch (err: unknown) {
			setStatus('error');
			setErrorMessage(
				err instanceof Error
					? err.message
					: 'Invite link could not be used'
			);
		}
	}, [legacyRedeem, username, password, locale, tenant, navigate]);

	const diceLabel = t('anonymousChat.pseudonym.changeName', 'Name ändern');

	return (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady={true} />}
			showLegalLinks
			showRegistrationLink={false}
		>
			<Box sx={{ maxWidth: 480, mx: 'auto', my: '40px', px: 2 }}>
				{(status === 'loading' || status === 'registering') && (
					<p>
						{t(
							'registration.registering',
							'Registrierung läuft...'
						)}
					</p>
				)}
				{status === 'identity' && identity && (
					<Box>
						<Typography
							component="h1"
							sx={{ mb: 1, ...registrationScreenTitleSx }}
						>
							{t(
								'registration.account.headline',
								'Anmeldedaten erfassen'
							)}
						</Typography>
						<Typography
							sx={{ mb: 3, ...registrationScreenIntroSx }}
						>
							{t(
								'registration.account.subline',
								'Um Ihre Anonymität zu schützen, raten wir Ihnen, nicht Ihren tatsächlichen Namen oder Initialen zu verwenden.'
							)}
						</Typography>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								mb: 1
							}}
						>
							<AnimalAvatar avatar={identity.avatar} size={48} />
							<Typography
								variant="body2"
								sx={{ color: registrationMd3.onSurfaceVariant }}
							>
								{identity.displayName}
							</Typography>
						</Box>
						<OrisoTextField
							value={username}
							placeholder={t(
								'registration.account.username.label',
								'User-ID'
							)}
							helperText={t(
								'registration.account.username.info',
								'Anonymer Login-Name. Bitte keine echten Namen oder Initialen verwenden.'
							)}
							fullWidth
							autoComplete="username"
							inputProps={{
								'aria-label': t(
									'registration.account.username.label',
									'User-ID'
								),
								'readOnly': true
							}}
							InputProps={{
								readOnly: true,
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											edge="end"
											onClick={handleReroll}
											aria-label={diceLabel}
											title={diceLabel}
											sx={{
												'color':
													registrationMd3.onSurfaceVariant,
												'&:hover': {
													backgroundColor:
														registrationMd3.focusLayer
												},
												'&:focus-visible': {
													outline: `2px solid ${registrationMd3.focus}`,
													outlineOffset: 2
												}
											}}
										>
											<Box
												component="img"
												src={genDiceIcon}
												alt=""
												sx={{ width: 20, height: 20 }}
											/>
										</IconButton>
									</InputAdornment>
								)
							}}
						/>
						<OrisoTextField
							value={password}
							placeholder={t(
								'registration.account.password.label',
								'Passwort'
							)}
							helperText={t(
								'anonymousChat.password.warning',
								'Bitte kopieren Sie das Passwort und speichern Sie es sicher, um später auf Ihr Konto zugreifen zu können.'
							)}
							fullWidth
							autoComplete="new-password"
							inputProps={{
								'aria-label': t(
									'registration.account.password.label',
									'Passwort'
								),
								'readOnly': true
							}}
							InputProps={{
								readOnly: true
							}}
						/>
						<Button
							fullWidth
							variant="contained"
							onClick={handleContinue}
							sx={{
								'mt': 3,
								'textTransform': 'none',
								'backgroundColor': registrationMd3.primary,
								'color': registrationMd3.onPrimary,
								'&:hover': {
									backgroundColor: registrationMd3.primaryDark
								},
								'&:focus-visible': {
									outline: `2px solid ${registrationMd3.focus}`,
									outlineOffset: 2
								}
							}}
						>
							{t(
								'anonymousChat.pseudonym.continueWithSelection',
								'Weiter mit Auswahl'
							)}
						</Button>
					</Box>
				)}
				{status === 'error' && (
					<div>
						<h3>
							{t(
								'inviteLink.error.title',
								'This invite link can no longer be used'
							)}
						</h3>
						<p>{errorMessage}</p>
					</div>
				)}
			</Box>
		</StageLayout>
	);
};
