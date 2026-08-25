import {
	Box,
	Button,
	Checkbox,
	FormControlLabel,
	FormGroup,
	IconButton,
	InputAdornment,
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
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import {
	RegistrationContext,
	RegistrationData
} from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
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
import { PasswordRuleChips } from './PasswordRuleChips';
import { getAccountDataDraft, setAccountDataDraft } from './accountDataDraft';
import {
	ConsentResolution,
	consentBindingKey,
	consentInputKey,
	departmentMayHaveConsentText,
	effectiveConsentResolution,
	mayAcceptConsent
} from './consentAcceptance';
import { useTraegerSentenceHtml } from './useTraegerSentenceHtml';
import { allPasswordCriteriaPass } from './passwordRules';
import { getUsernameFeedback } from './usernameFeedback';
import genUserIcon from '../../../resources/img/registration-md3/icons/gen-user.svg';
import genKeyIcon from '../../../resources/img/registration-md3/icons/gen-key.svg';
import genAvatarIcon from '../../../resources/img/registration-md3/icons/gen-avatar.svg';
import genDiceIcon from '../../../resources/img/registration-md3/icons/gen-dice.svg';
import { DepartmentLegalSection } from '../../departmentLegal/DepartmentLegalSection';
import { DataProtectionConsentLabel } from './DataProtectionConsentLabel';
import { toRegistrationUsername } from './registrationUsername';

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
	const [acceptedConsentBinding, setAcceptedConsentBinding] = useState<
		string | null
	>(restoredDraft?.acceptedConsentBinding ?? null);
	const [isRepeatPasswordVisible, setIsRepeatPasswordVisible] =
		useState<boolean>(false);
	const [username, setUsername] = useState<string>(
		restoredDraft?.username ?? ''
	);
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
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const agency = registrationData?.agency;
	const mainTopic = registrationData?.mainTopic;

	/* While the consent sentence is being fetched there is no wording next to
	   the checkbox, and agreement to wording nobody has seen is not agreement.
	   The label reports its resolution here so the control can stay inert until
	   there is something to consent to. Seeded from the same predicate the
	   label uses, so the far more common unconfigured case — which issues no
	   request at all — is never disabled, not even for one frame. */
	/* The complete input state the label's answer must match — derived during
	   render, in the same one place the label derives it, so the two cannot
	   drift and no input can be forgotten from the comparison. */
	const consentInputs = consentInputKey(agency, mainTopic);
	const [consentResolution, setConsentResolution] =
		useState<ConsentResolution>(() =>
			departmentMayHaveConsentText(agency, mainTopic)
				? { status: 'pending' }
				: {
						status: 'resolved',
						consentText: null,
						inputKey: consentInputs
					}
		);
	/* A resolution answers the selection that produced it and no other. The
	   label applies the same check, but this component holds its own copy of
	   the state, so between an agency/topic change and the label's effect
	   reporting the new `pending` it would otherwise still be holding the
	   previous Beratungsstelle's answer — enabling acceptance of the old
	   sentence while writing a binding under the new identity. Checking here
	   too makes that independent of effect ordering. */
	/* The same derivation the label uses, so the sentence on screen and the
	   gate that lets it be accepted can never disagree — including for an
	   unconfigured Fachbereich, which resolves synchronously because nothing is
	   loading for it. */
	const effectiveConsent = effectiveConsentResolution(
		consentResolution,
		agency,
		mainTopic
	);
	/* The sentence exactly as it reaches the DOM — the same hook `ConsentSentence`
	   renders from, so the gate cannot believe a sentence is on screen that is
	   not. Null here means either "no Träger text configured" (platform wording
	   applies, acceptance is fine) or "configured but unrenderable", which the
	   next line separates. */
	const traegerSentence = useTraegerSentenceHtml(
		effectiveConsent.status === 'resolved'
			? effectiveConsent.consentText
			: null
	);
	/* A configured Träger text that cannot be rendered must block acceptance.
	   Otherwise the platform sentence would be on screen while the acceptance
	   binds to the Träger versionId, and the help-seeker consents to wording
	   they never saw (ORISO-Frontend#1110). */
	const traegerSentenceUnrenderable =
		effectiveConsent.status === 'resolved' &&
		!!effectiveConsent.consentText &&
		!traegerSentence;
	const isConsentSentenceResolved =
		mayAcceptConsent(effectiveConsent, consentInputs) &&
		!traegerSentenceUnrenderable;
	/* Which consent is on offer right now. Null while the sentence is unknown —
	   there is nothing to accept yet. */
	const currentConsentBinding =
		isConsentSentenceResolved && effectiveConsent.status === 'resolved'
			? consentBindingKey(
					agency?.id,
					mainTopic?.id,
					effectiveConsent.consentText?.versionId,
					/* For a Träger sentence the fingerprint is the wording
					   itself, which already varies by language. The platform
					   fallback passes no wording, so without the locale every
					   language produced the same binding: tick the German
					   sentence, switch to English with the pill, and the box
					   stays ticked beside wording nobody affirmatively accepted
					   (ORISO-Frontend#1110). */
					traegerSentence?.authored ?? `platform:${locale}`
				)
			: null;
	/* Ticked only while the acceptance on record is the acceptance of *this*
	   wording. Change the Beratungsstelle, the topic, or publish a new version,
	   and the box unticks itself because the agreement no longer matches what is
	   being asked. Come back to the same one and it is still ticked. */
	const dataProtectionChecked =
		currentConsentBinding !== null &&
		acceptedConsentBinding === currentConsentBinding;

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
			acceptedConsentBinding,
			email,
			twoFactorAuthEnabled
		});
	}, [
		identity,
		username,
		password,
		repeatPassword,
		acceptedConsentBinding,
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
			// Not merely "the box is ticked": the box may only count once the
			// sentence it sits next to is actually on screen.
			isConsentSentenceResolved &&
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
		isConsentSentenceResolved,
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
							disabled={!isConsentSentenceResolved}
							onClick={() => {
								setAcceptedConsentBinding(
									dataProtectionChecked
										? null
										: currentConsentBinding
								);
							}}
							sx={{ mt: '-9px' }}
						/>
					}
					label={
						/* The sentence itself is resolved in its own component:
						   a Träger-authored consent text when the selected
						   Fachbereich has one (ADR-021), otherwise exactly the
						   three-fragment sentence this used to assemble inline. */
						<DataProtectionConsentLabel
							agency={agency}
							topic={mainTopic}
							onResolutionChange={setConsentResolution}
						/>
					}
				/>
			</FormGroup>
			{/* Department-specific data privacy policy: shown when the
			    selected agency has a published DPP for the selected topic;
			    falls back to the tenant text if it cannot be loaded. */}
			<Box sx={{ mt: '12px' }}>
				<DepartmentLegalSection
					agency={agency}
					topic={mainTopic}
					variant="consent"
				/>
			</Box>
		</Box>
	);
};
