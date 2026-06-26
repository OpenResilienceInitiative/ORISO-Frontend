import {
	Box,
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
	SetStateAction,
	useContext,
	useEffect,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
	hasMixedLetters,
	hasNumber,
	hasSpecialChar
} from '../../../utils/validateInputValue';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { RegistrationContext, RegistrationData } from '../../../globalState';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';
import { REGISTRATION_DATA_VALIDATION } from '../registrationDataValidation';
import LegalLinks from '../../../components/legalLinks/LegalLinks';
import {
	registrationMd3,
	registrationMd3TextFieldSx
} from '../registrationDesign/registrationDesign';

export const passwordCriteria = [
	{
		info: 'registration.account.password.criteria1',
		validation: (val) => val.length > 8
	},
	{
		info: 'registration.account.password.criteria2',
		validation: (val) => hasNumber(val)
	},
	{
		info: 'registration.account.password.criteria3',
		validation: (val) => hasMixedLetters(val)
	},
	{
		info: 'registration.account.password.criteria4',
		validation: (val) => hasSpecialChar(val)
	}
];

export const AccountData: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
}> = ({ onChange }) => {
	const legalLinks = useContext(LegalLinksContext);
	const { t } = useTranslation();
	const [password, setPassword] = useState<string>('');
	const [repeatPassword, setRepeatPassword] = useState<string>('');
	const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>();
	const [dataProtectionChecked, setDataProtectionChecked] =
		useState<boolean>(false);
	const [isRepeatPasswordVisible, setIsRepeatPasswordVisible] =
		useState<boolean>();
	const [username, setUsername] = useState<string>('');
	const [isUsernameAvailable, setIsUsernameAvailable] =
		useState<boolean>(true);
	const [usernameWasBlurred, setUsernameWasBlurred] =
		useState<boolean>(false);
	const [usernameAvailabilityChecked, setUsernameAvailabilityChecked] =
		useState<boolean>(false);
	const { setDisabledNextButton } = useContext(RegistrationContext);

	const isUsernameLongEnough =
		REGISTRATION_DATA_VALIDATION.username.validation(username);
	const isPasswordValid = passwordCriteria.every((criteria) =>
		criteria.validation(password)
	);
	const repeatPasswordMismatch =
		repeatPassword.length > 0 && repeatPassword !== password;
	const repeatPasswordMatches =
		repeatPassword.length > 0 && repeatPassword === password;

	useEffect(() => {
		if (!isUsernameLongEnough) {
			setIsUsernameAvailable(true);
			setUsernameAvailabilityChecked(false);
			return;
		}

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
					setIsUsernameAvailable(false);
					setUsernameAvailabilityChecked(true);
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
		isUsernameLongEnough,
		isPasswordValid,
		setDisabledNextButton,
		onChange
	]);

	const usernameHasError =
		(usernameWasBlurred && !isUsernameLongEnough) ||
		(usernameAvailabilityChecked && !isUsernameAvailable);
	const usernameHelperText = usernameHasError
		? isUsernameAvailable
			? t('registration.account.username.error.available')
			: t('registration.account.username.error.unavailable')
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

	return (
		<Box sx={{ maxWidth: 560 }}>
			<Typography
				variant="h3"
				sx={{
					color: registrationMd3.onSurface,
					fontWeight: 800,
					lineHeight: 1.2
				}}
			>
				{t('registration.account.headline')}
			</Typography>
			<Typography
				sx={{
					mt: '12px',
					mb: '20px',
					color: registrationMd3.onSurfaceVariant
				}}
			>
				{t('registration.account.subline')}
			</Typography>
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
				sx={{ mt: '24px', ...registrationMd3TextFieldSx }}
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
							<LockOutlinedIcon
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
			<Box
				component="ul"
				sx={{ listStyle: 'none', m: 0, mt: 1.25, p: 0 }}
			>
				{passwordCriteria.map((criteria) => {
					const passed = criteria.validation(password);

					return (
						<Box
							component="li"
							key={criteria.info}
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								mb: 0.5
							}}
						>
							{passed ? (
								<CheckCircleRoundedIcon
									sx={{
										fontSize: 20,
										color: registrationMd3.primary
									}}
								/>
							) : (
								<RadioButtonUncheckedIcon
									sx={{
										fontSize: 20,
										color: registrationMd3.outline
									}}
								/>
							)}
							<Typography
								variant="body2"
								sx={{
									fontSize: '16px',
									lineHeight: '22px',
									color: passed
										? registrationMd3.onSurface
										: registrationMd3.onSurfaceVariant
								}}
							>
								{passed && (
									<span className="sr-only">
										{t(
											'registration.password.criteria.fulfilled'
										)}
										:{' '}
									</span>
								)}
								{t(criteria.info)}
							</Typography>
						</Box>
					);
				})}
			</Box>
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
							<LockOutlinedIcon
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
