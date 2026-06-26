import {
	Box,
	Button,
	Checkbox,
	FormControlLabel,
	FormGroup,
	IconButton,
	InputAdornment,
	Link,
	TextField,
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
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import {
	LocaleContext,
	RegistrationContext,
	RegistrationData
} from '../../../globalState';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import LegalLinks from '../../../components/legalLinks/LegalLinks';
import {
	registrationMd3,
	registrationMd3TextFieldSx,
	registrationScreenIntroSx,
	registrationScreenKickerSx,
	registrationScreenTitleSx
} from '../registrationDesign/registrationDesign';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import {
	generateAvatar,
	generatePassword,
	generatePseudonym,
	regeneratePseudonym,
	type Pseudonym
} from '../../../utils/pseudonymGenerator';
import { PasswordRuleChips } from './PasswordRuleChips';
import { allPasswordCriteriaPass } from './passwordRules';
import genUserIcon from '../../../resources/img/registration-md3/icons/gen-user.svg';
import genKeyIcon from '../../../resources/img/registration-md3/icons/gen-key.svg';
import genAvatarIcon from '../../../resources/img/registration-md3/icons/gen-avatar.svg';
import genDiceIcon from '../../../resources/img/registration-md3/icons/gen-dice.svg';

const toRegistrationUsername = (displayName: string) => {
	const normalized = displayName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_{2,}/g, '_');
	const safeBase = normalized || 'oriso';
	const suffix = Math.floor(100 + Math.random() * 900);
	const suffixText = `_${suffix}`;
	const maxBaseLength = 48 - suffixText.length;

	return `${safeBase.slice(0, maxBaseLength)}${suffixText}`;
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
		'&:hover': filled
			? {
					backgroundColor: registrationMd3.primaryDark
				}
			: {
					borderColor: registrationMd3.outline,
					backgroundColor: registrationMd3.hoverLayer
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
	const [identity, setIdentity] = useState<Pseudonym>(() =>
		generatePseudonym(locale)
	);
	const [password, setPassword] = useState<string>('');
	const [repeatPassword, setRepeatPassword] = useState<string>('');
	const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
	const [dataProtectionChecked, setDataProtectionChecked] =
		useState<boolean>(false);
	const [isRepeatPasswordVisible, setIsRepeatPasswordVisible] =
		useState<boolean>(false);
	const [username, setUsername] = useState<string>('');
	const [isUsernameAvailable, setIsUsernameAvailable] =
		useState<boolean>(true);
	const [usernameWasBlurred, setUsernameWasBlurred] =
		useState<boolean>(false);
	const [usernameAvailabilityChecked, setUsernameAvailabilityChecked] =
		useState<boolean>(false);
	const [usernameAvailabilityFailed, setUsernameAvailabilityFailed] =
		useState<boolean>(false);
	const { setDisabledNextButton } = useContext(RegistrationContext);

	const resetUsernameAvailability = useCallback(() => {
		setUsernameAvailabilityChecked(false);
		setIsUsernameAvailable(true);
		setUsernameAvailabilityFailed(false);
		setUsernameWasBlurred(false);
	}, []);

	const applyGeneratedUsername = useCallback(
		(nextIdentity: Pseudonym) => {
			setIdentity(nextIdentity);
			setUsername(toRegistrationUsername(nextIdentity.displayName));
			resetUsernameAvailability();
		},
		[resetUsernameAvailability]
	);

	useEffect(() => {
		applyGeneratedUsername(identity);
		// Run once so first entry shows the same generated identity until the
		// user intentionally changes it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const isUsernameLongEnough =
		REGISTRATION_DATA_VALIDATION.username.validation(username);
	const isPasswordValid = allPasswordCriteriaPass(password);
	const repeatPasswordMismatch =
		repeatPassword.length > 0 && repeatPassword !== password;
	const repeatPasswordMatches =
		repeatPassword.length > 0 && repeatPassword === password;

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
			dataProtectionChecked
		) {
			setDisabledNextButton(false);
			onChange({ username, password });
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
		setDisabledNextButton,
		onChange
	]);

	const usernameHasError =
		(usernameWasBlurred && !isUsernameLongEnough) ||
		usernameAvailabilityFailed ||
		(usernameAvailabilityChecked && !isUsernameAvailable);
	const usernameHelperText = usernameHasError
		? isUsernameAvailable
			? t('registration.account.username.error.tooShort')
			: t('registration.account.username.error.unavailable')
		: usernameAvailabilityFailed
			? t('registration.account.username.error.retry')
			: usernameAvailabilityChecked && isUsernameAvailable
				? t('registration.account.username.success')
				: t('registration.account.username.info');
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

			<TextField
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
				sx={{ ...registrationMd3TextFieldSx }}
			/>
			<TextField
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
				sx={{ mt: '24px', ...registrationMd3TextFieldSx }}
			/>
			<PasswordRuleChips password={password} />
			<TextField
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
				sx={{ mt: '20px', ...registrationMd3TextFieldSx }}
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
						<Typography>
							<LegalLinks
								delimiter={', '}
								filter={(legalLink) => legalLink.registration}
								legalLinks={legalLinks}
								params={{ aid: null }}
								prefix={t(
									'registration.dataProtection.label.prefix'
								)}
								lastDelimiter={t(
									'registration.dataProtection.label.and'
								)}
								suffix={t(
									'registration.dataProtection.label.suffix'
								)}
							>
								{(label, url) => (
									<Link target="_blank" href={url}>
										{label}
									</Link>
								)}
							</LegalLinks>
						</Typography>
					}
				/>
			</FormGroup>
		</Box>
	);
};
