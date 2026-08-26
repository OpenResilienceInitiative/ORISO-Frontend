import {
	Box,
	Button,
	Checkbox,
	FormControlLabel,
	FormGroup,
	IconButton,
	InputAdornment,
	Link,
	Typography
} from '@mui/material';
import * as React from 'react';
import {
	Dispatch,
	FC,
	ReactNode,
	SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import {
	RegistrationContext,
	RegistrationData
} from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { useDepartmentLegal } from '../../../api/useDepartmentLegal';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import LegalLinks from '../../../components/legalLinks/LegalLinks';
import { getEmailFeedback } from './emailFeedback';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenKickerSx,
	registrationScreenTitleSx
} from '../registrationDesign/registrationDesign';
import { OrisoTextField } from '../../form/OrisoTextField';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import {
	generateAvatar,
	generatePassword,
	generatePseudonym,
	regeneratePseudonym,
	type Pseudonym
} from '../../../utils/pseudonymGenerator';
import { resolveLegalContent } from '../../../utils/legalContent';
import { PasswordRuleChips } from './PasswordRuleChips';
import { getAccountDataDraft, setAccountDataDraft } from './accountDataDraft';
import { allPasswordCriteriaPass } from './passwordRules';
import { getUsernameFeedback } from './usernameFeedback';
import genUserIcon from '../../../resources/img/registration-md3/icons/gen-user.svg';
import genKeyIcon from '../../../resources/img/registration-md3/icons/gen-key.svg';
import genAvatarIcon from '../../../resources/img/registration-md3/icons/gen-avatar.svg';
import genDiceIcon from '../../../resources/img/registration-md3/icons/gen-dice.svg';
import { toRegistrationUsername } from './registrationUsername';

/**
 * Checkbox label for registration data protection: department consent
 * sentence when present (language already resolved), otherwise the platform
 * i18n + LegalLinks sentence. Consent text is shown as-is — no client-side
 * token substitution. While the department legal request is in flight, render
 * nothing so the i18n fallback does not flash before Träger text arrives.
 */
export const DataProtectionCheckboxLabel: FC<{
	consentSentence: string | null;
	isLoading: boolean;
	legalLinks: TProvidedLegalLink[];
}> = ({ consentSentence, isLoading, legalLinks }) => {
	const { t } = useTranslation();

	if (isLoading) {
		return null;
	}

	if (consentSentence) {
		return (
			<Typography data-cy="registration-data-protection-label">
				{consentSentence}
			</Typography>
		);
	}

	return (
		<Typography data-cy="registration-data-protection-label">
			<LegalLinks
				delimiter=", "
				filter={(legalLink) => legalLink.registration}
				legalLinks={legalLinks}
				params={{ aid: null }}
				prefix={t('registration.dataProtection.label.prefix')}
				lastDelimiter={t('registration.dataProtection.label.and')}
				suffix={t('registration.dataProtection.label.suffix')}
			>
				{(label, url) => (
					<Link target="_blank" href={url}>
						{label}
					</Link>
				)}
			</LegalLinks>
		</Typography>
	);
};

const suggestButtonSx = (filled: boolean) =>
	({
		'px': 1,
		'py': 0.75,
		'fontSize': 13.5,
		'lineHeight': '20px',
		'minWidth': 0,
		'flex': '1 1 auto',
		'borderRadius': '8px',
		'textTransform': 'none',
		'color': filled ? registrationMd3.onPrimary : registrationMd3.onSurface,
		'borderColor': registrationMd3.outlineVariant,
		'backgroundColor': filled ? registrationMd3.primary : undefined,
		'& .MuiButton-startIcon': {
			mr: 0.625
		},
		'& .registration-suggest-icon': {
			filter: filled ? 'brightness(0) invert(1)' : 'none',
			transition: 'filter 140ms ease'
		},
		'&:hover': filled
			? {
					backgroundColor: registrationMd3.primaryDark
				}
			: {
					'color': registrationMd3.onSecondary,
					'borderColor': registrationMd3.secondary,
					'backgroundColor': registrationMd3.secondary,
					'& .registration-suggest-icon': {
						filter: 'brightness(0) invert(1)'
					}
				},
		'&&:active, &&:active:hover': {
			'color': registrationMd3.onPrimary,
			'WebkitTextFillColor': registrationMd3.onPrimary,
			'borderColor': registrationMd3.primary,
			'backgroundColor': registrationMd3.primary,
			'& .MuiButton-startIcon, & .MuiButton-endIcon': {
				color: registrationMd3.onPrimary
			},
			'& .registration-suggest-icon': {
				filter: 'brightness(0) invert(1)'
			}
		},
		'&:focus-visible': {
			outline: `2px solid ${registrationMd3.focus}`,
			outlineOffset: 2
		}
	}) as const;

export const AccountData: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ onChange }) => {
	const legalLinks = useContext(LegalLinksContext);
	const { locale } = useContext(LocaleContext);
	const { t } = useTranslation();
	/* Restore the in-memory draft (if any) so navigating away and back in the
	   stepper keeps everything typed — identity, username, passwords and the
	   privacy checkbox. The draft never touches session/localStorage. */
	const [restoredDraft] = useState(() => getAccountDataDraft());
	const [identity, setIdentity] = useState<Pseudonym>(
		() => restoredDraft?.identity ?? generatePseudonym(locale)
	);
	const [password, setPassword] = useState<string>(
		restoredDraft?.password ?? ''
	);
	const [repeatPassword, setRepeatPassword] = useState<string>(
		restoredDraft?.repeatPassword ?? ''
	);
	const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
	const [dataProtectionChecked, setDataProtectionChecked] = useState<boolean>(
		restoredDraft?.dataProtectionChecked ?? false
	);
	const [isRepeatPasswordVisible, setIsRepeatPasswordVisible] =
		useState<boolean>(false);
	const [username, setUsername] = useState<string>(
		restoredDraft?.username ?? ''
	);
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const agencyId = registrationData?.agency?.id;
	const topicId = registrationData?.mainTopic?.id;
	const departmentLegalEnabled = !!(agencyId && topicId);
	const { data: departmentLegal, loading: isDepartmentLegalLoading } =
		useDepartmentLegal(agencyId, topicId, {
			enabled: departmentLegalEnabled
		});
	const departmentConsentSentence = departmentLegalEnabled
		? resolveLegalContent(
				departmentLegal?.dpp?.consentText,
				locale
			)?.html?.trim() || null
		: null;
	const { tenant } = useContext(TenantContext);
	const emailVisible = tenant?.settings?.emailVisible ?? false;
	const emailRequired = tenant?.settings?.emailRequired ?? false;
	const [email, setEmail] = useState<string>(restoredDraft?.email ?? '');
	const [emailWasBlurred, setEmailWasBlurred] = useState<boolean>(false);
	const [twoFactorAuthEnabled, setTwoFactorAuthEnabled] = useState<boolean>(
		restoredDraft?.twoFactorAuthEnabled ?? false
	);
	// A confirmable email is 2FA's second channel — requiring it here is a
	// frontend-only guard until the backend module (email confirmation,
	// persisted preference) lands; see #260.
	const effectiveEmailRequired = emailRequired || twoFactorAuthEnabled;
	const [isUsernameAvailable, setIsUsernameAvailable] =
		useState<boolean>(true);
	const [usernameWasBlurred, setUsernameWasBlurred] =
		useState<boolean>(false);
	const [usernameAvailabilityChecked, setUsernameAvailabilityChecked] =
		useState<boolean>(false);
	const [usernameAvailabilityFailed, setUsernameAvailabilityFailed] =
		useState<boolean>(false);

	const resetUsernameAvailability = useCallback(() => {
		setUsernameAvailabilityChecked(false);
		setIsUsernameAvailable(true);
		setUsernameAvailabilityFailed(false);
		setUsernameWasBlurred(false);
	}, []);

	const applyGeneratedUsername = useCallback(
		(nextIdentity: Pseudonym) => {
			setIdentity(nextIdentity);
			setUsername(toRegistrationUsername(nextIdentity));
			resetUsernameAvailability();
		},
		[resetUsernameAvailability]
	);

	useEffect(() => {
		// Run once so first entry shows the same generated identity until the
		// user intentionally changes it. When a draft was restored the user's
		// previous identity/username must NOT be overwritten by a fresh one —
		// the debounced availability effect below re-checks it anyway.
		if (!restoredDraft) {
			applyGeneratedUsername(identity);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/* Keep the draft current on every change so stepper navigation is lossless. */
	useEffect(() => {
		setAccountDataDraft({
			identity,
			username,
			password,
			repeatPassword,
			dataProtectionChecked,
			email,
			twoFactorAuthEnabled
		});
	}, [
		identity,
		username,
		password,
		repeatPassword,
		dataProtectionChecked,
		email,
		twoFactorAuthEnabled
	]);

	const isUsernameLongEnough =
		REGISTRATION_DATA_VALIDATION.username.validation(username);
	const isPasswordValid = allPasswordCriteriaPass(password);
	const repeatPasswordMismatch =
		repeatPassword.length > 0 && repeatPassword !== password;
	const repeatPasswordMatches =
		repeatPassword.length > 0 && repeatPassword === password;
	const emailFeedback = getEmailFeedback({
		visible: emailVisible,
		required: effectiveEmailRequired,
		wasBlurred: emailWasBlurred,
		email
	});

	useEffect(() => {
		if (!isUsernameLongEnough) {
			setIsUsernameAvailable(true);
			setUsernameAvailabilityChecked(false);
			setUsernameAvailabilityFailed(false);
			return;
		}

		setUsernameAvailabilityChecked(false);
		setUsernameAvailabilityFailed(false);

		let canceled = false;
		const timeout = window.setTimeout(async () => {
			try {
				const usernameAvailable =
					await apiGetIsUsernameAvailable(username);

				if (!canceled) {
					setIsUsernameAvailable(usernameAvailable);
					setUsernameAvailabilityChecked(true);
				}
			} catch {
				if (!canceled) {
					setIsUsernameAvailable(true);
					setUsernameAvailabilityChecked(false);
					setUsernameAvailabilityFailed(true);
				}
			}
		}, 350);

		return () => {
			canceled = true;
			window.clearTimeout(timeout);
		};
	}, [isUsernameLongEnough, username]);

	useEffect(() => {
		if (
			usernameAvailabilityChecked &&
			!usernameAvailabilityFailed &&
			isUsernameAvailable &&
			isUsernameLongEnough &&
			isPasswordValid &&
			password === repeatPassword &&
			dataProtectionChecked &&
			emailFeedback.isSatisfied
		) {
			const trimmedEmail = email.trim();
			setDisabledNextButton(false);
			onChange({
				username,
				password,
				...(emailVisible && trimmedEmail ? { email: trimmedEmail } : {})
			});
		} else {
			setDisabledNextButton(true);
		}
	}, [
		username,
		password,
		repeatPassword,
		dataProtectionChecked,
		isUsernameAvailable,
		usernameAvailabilityChecked,
		usernameAvailabilityFailed,
		isUsernameLongEnough,
		isPasswordValid,
		emailFeedback.isSatisfied,
		email,
		emailVisible,
		setDisabledNextButton,
		onChange
	]);

	const { hasError: usernameHasError, helperTextKey } = getUsernameFeedback({
		wasBlurred: usernameWasBlurred,
		isLongEnough: isUsernameLongEnough,
		isAvailable: isUsernameAvailable,
		availabilityChecked: usernameAvailabilityChecked,
		availabilityCheckFailed: usernameAvailabilityFailed
	});

	const usernameHelperText = t(helperTextKey);
	const emailHelperText = emailFeedback.helperTextKey
		? t(emailFeedback.helperTextKey)
		: undefined;

	const visibilityButtonSx = {
		'color': registrationMd3.onSurfaceVariant,
		'&:hover': {
			color: registrationMd3.onSurfaceVariant,
			backgroundColor: registrationMd3.focusLayer
		},
		'&:focus-visible': {
			outline: `2px solid ${registrationMd3.focus}`,
			outlineOffset: 2
		}
	} as const;

	const suggestUsername = () =>
		applyGeneratedUsername(regeneratePseudonym(identity, locale));
	const suggestAvatar = () =>
		setIdentity((currentIdentity) => ({
			...currentIdentity,
			avatar: generateAvatar(locale)
		}));
	const suggestPassword = () => {
		const generatedPassword = generatePassword();
		setPassword(generatedPassword);
		setRepeatPassword(generatedPassword);
		setIsPasswordVisible(true);
		setIsRepeatPasswordVisible(true);
	};
	const suggestAll = () => {
		applyGeneratedUsername(regeneratePseudonym(identity, locale));
		suggestPassword();
	};
	const suggestButton = (
		icon: string,
		label: ReactNode,
		onClick: () => void,
		filled = false
	) => (
		<Button
			variant={filled ? 'contained' : 'outlined'}
			onClick={onClick}
			startIcon={
				<Box
					component="img"
					className="registration-suggest-icon"
					src={icon}
					alt=""
					sx={{ width: 17, height: 17, flexShrink: 0 }}
				/>
			}
			sx={suggestButtonSx(filled)}
		>
			<Box
				component="span"
				sx={{
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				}}
			>
				{label}
			</Box>
		</Button>
	);

	return (
		<Box sx={{ maxWidth: 540, width: '100%', mx: 'auto' }}>
			<Box
				sx={{
					display: 'flex',
					gap: 2,
					alignItems: 'flex-start',
					justifyContent: 'space-between'
				}}
			>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography
						component="h1"
						variant="h3"
						sx={registrationScreenTitleSx}
					>
						{t('registration.account.headline')}
					</Typography>
					<Typography
						sx={{
							mt: '12px',
							...registrationScreenIntroSx
						}}
					>
						{t('registration.account.subline')}
					</Typography>
				</Box>
				<Box
					sx={{
						'flexShrink': 0,
						'mt': { xs: '-4px', md: '-8px' },
						'& > div': {
							width: { xs: 88, sm: 104 },
							height: { xs: 88, sm: 104 }
						}
					}}
				>
					<AnimalAvatar avatar={identity.avatar} size={104} />
				</Box>
			</Box>

			<Typography
				sx={{
					mt: '24px',
					mb: '8px',
					...registrationScreenKickerSx
				}}
			>
				{t('registration.account.autoSuggest')}
			</Typography>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'nowrap',
					gap: 0.75,
					mb: '24px',
					overflow: 'hidden',
					containerType: 'inline-size'
				}}
			>
				{suggestButton(
					genUserIcon,
					t('registration.account.suggest.username'),
					suggestUsername
				)}
				{suggestButton(
					genKeyIcon,
					t('registration.account.suggest.password'),
					suggestPassword
				)}
				{suggestButton(
					genAvatarIcon,
					t('registration.account.suggest.avatar'),
					suggestAvatar
				)}
				{suggestButton(
					genDiceIcon,
					<>
						<Box
							component="span"
							sx={{
								'display': 'none',
								'@container (min-width: 520px)': {
									display: 'inline'
								}
							}}
						>
							{t('registration.account.suggest.all')}
						</Box>
						<Box
							component="span"
							sx={{
								'display': 'inline',
								'@container (min-width: 520px)': {
									display: 'none'
								}
							}}
						>
							{t('registration.account.suggest.allShort')}
						</Box>
					</>,
					suggestAll,
					true
				)}
			</Box>

			<OrisoTextField
				value={username}
				onChange={(event) => {
					const normalizedVal = event.target.value
						.toLowerCase()
						.replace(/[^a-z0-9_-]/g, '');
					setUsername(normalizedVal);
					setUsernameAvailabilityChecked(false);
					setIsUsernameAvailable(true);
				}}
				onBlur={() => setUsernameWasBlurred(true)}
				placeholder={t('registration.account.username.label')}
				helperText={usernameHelperText}
				error={usernameHasError}
				fullWidth
				autoComplete="username"
				inputProps={{
					'aria-label': t('registration.account.username.label')
				}}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<PersonOutlineIcon
								sx={{ color: registrationMd3.onSurfaceVariant }}
							/>
						</InputAdornment>
					)
				}}
			/>
			{emailVisible && (
				<OrisoTextField
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					onBlur={() => setEmailWasBlurred(true)}
					placeholder={t('registration.account.email.label')}
					helperText={emailHelperText}
					error={emailFeedback.hasError}
					type="email"
					fullWidth
					autoComplete="email"
					inputProps={{
						'aria-label': t('registration.account.email.label'),
						'aria-required': effectiveEmailRequired
					}}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<EmailOutlinedIcon
									sx={{
										color: registrationMd3.onSurfaceVariant
									}}
								/>
							</InputAdornment>
						)
					}}
					sx={{ mt: '20px' }}
				/>
			)}
			{emailVisible && (
				<FormGroup sx={{ mt: '4px' }}>
					<FormControlLabel
						sx={{ alignItems: 'flex-start' }}
						control={
							<Checkbox
								checked={twoFactorAuthEnabled}
								onClick={() =>
									setTwoFactorAuthEnabled(
										!twoFactorAuthEnabled
									)
								}
								inputProps={{
									'aria-label': t(
										'registration.account.twoFactorAuth.label'
									)
								}}
								sx={{ mt: '-9px' }}
							/>
						}
						label={
							<Typography>
								{t('registration.account.twoFactorAuth.label')}
							</Typography>
						}
					/>
				</FormGroup>
			)}
			<OrisoTextField
				value={password}
				onChange={(event) => setPassword(event.target.value)}
				placeholder={t('registration.account.password.label')}
				type={isPasswordVisible ? 'text' : 'password'}
				fullWidth
				autoComplete="new-password"
				inputProps={{
					'aria-label': t('registration.account.password.label')
				}}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<VpnKeyOutlinedIcon
								sx={{ color: registrationMd3.onSurfaceVariant }}
							/>
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								onClick={() =>
									setIsPasswordVisible(!isPasswordVisible)
								}
								edge="end"
								aria-label={t(
									isPasswordVisible
										? 'login.password.hide'
										: 'login.password.show'
								)}
								title={t(
									isPasswordVisible
										? 'login.password.hide'
										: 'login.password.show'
								)}
								sx={visibilityButtonSx}
							>
								{isPasswordVisible ? (
									<VisibilityOffIcon />
								) : (
									<VisibilityIcon />
								)}
							</IconButton>
						</InputAdornment>
					)
				}}
				sx={{ mt: '24px' }}
			/>
			<PasswordRuleChips password={password} />
			<OrisoTextField
				value={repeatPassword}
				onChange={(event) => setRepeatPassword(event.target.value)}
				placeholder={t('registration.account.repeatPassword.label')}
				type={isRepeatPasswordVisible ? 'text' : 'password'}
				error={repeatPasswordMismatch}
				helperText={
					repeatPasswordMismatch
						? t('registration.account.repeatPassword.error')
						: repeatPasswordMatches
							? t('registration.account.repeatPassword.success')
							: undefined
				}
				FormHelperTextProps={{
					sx: repeatPasswordMatches
						? { color: `${registrationMd3.primary} !important` }
						: undefined
				}}
				fullWidth
				autoComplete="new-password"
				inputProps={{
					'aria-label': t('registration.account.repeatPassword.label')
				}}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<VpnKeyOutlinedIcon
								sx={{ color: registrationMd3.onSurfaceVariant }}
							/>
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								onClick={() =>
									setIsRepeatPasswordVisible(
										!isRepeatPasswordVisible
									)
								}
								edge="end"
								aria-label={t(
									isRepeatPasswordVisible
										? 'login.password.hide'
										: 'login.password.show'
								)}
								title={t(
									isRepeatPasswordVisible
										? 'login.password.hide'
										: 'login.password.show'
								)}
								sx={visibilityButtonSx}
							>
								{isRepeatPasswordVisible ? (
									<VisibilityOffIcon />
								) : (
									<VisibilityIcon />
								)}
							</IconButton>
						</InputAdornment>
					)
				}}
				sx={{ mt: '20px' }}
			/>
			<FormGroup sx={{ mt: '20px' }}>
				<FormControlLabel
					sx={{ alignItems: 'flex-start' }}
					control={
						<Checkbox
							checked={dataProtectionChecked}
							onClick={() => {
								setDataProtectionChecked(
									!dataProtectionChecked
								);
							}}
							sx={{ mt: '-9px' }}
						/>
					}
					label={
						<DataProtectionCheckboxLabel
							consentSentence={departmentConsentSentence}
							isLoading={isDepartmentLegalLoading}
							legalLinks={legalLinks}
						/>
					}
				/>
			</FormGroup>
		</Box>
	);
};
