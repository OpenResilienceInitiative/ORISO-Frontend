import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import FormControlLabel from '@mui/material/FormControlLabel';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

import StepHeading from './StepHeading';
import { md3 } from '../theme';

/** Controlled value for registration step 4 (login data). */
export interface RegisterValues {
	username: string;
	password: string;
	confirm: string;
	privacy: boolean;
}

const USERNAME_REGEX = /^[a-z0-9_-]+$/;

function normalizeUsername(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function isUsernameValid(username: string): boolean {
	return username.length >= 5 && USERNAME_REGEX.test(username);
}

/**
 * The four password rules, modelled as data so the UI can render *and*
 * live-check each one. `labelKey` is an i18n key; `test` is the predicate.
 */
const PASSWORD_RULES: { labelKey: string; test: (pw: string) => boolean }[] = [
	{ labelKey: 'reg.register.rule.length', test: (pw) => pw.length >= 9 },
	{ labelKey: 'reg.register.rule.number', test: (pw) => /\d/.test(pw) },
	// both an uppercase AND a lowercase letter
	{
		labelKey: 'reg.register.rule.case',
		test: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw)
	},
	// at least one non-alphanumeric character
	{
		labelKey: 'reg.register.rule.special',
		test: (pw) => /[^A-Za-z0-9]/.test(pw)
	}
];

/** True only when every password rule passes. */
function allPasswordRulesPass(password: string): boolean {
	return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** Gate for the "Continue" button: valid username + strong password + match + consent. */
export function isRegisterValid(v: RegisterValues): boolean {
	return (
		isUsernameValid(v.username) &&
		allPasswordRulesPass(v.password) &&
		v.confirm === v.password &&
		v.privacy
	);
}

/**
 * Registration step 4 — capture login data. Same design language as the
 * earlier steps (MUI, M3 tokens, 12px fields). Anonymity-first: we nudge the
 * user away from real names and enforce a strong password with live rule checks.
 */
export default function RegisterStep({
	value,
	onChange
}: {
	value: RegisterValues;
	onChange: (next: RegisterValues) => void;
}) {
	const { t } = useTranslation();

	// Local-only UI state: per-field show/hide toggles for the two password fields.
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	// Only flag a mismatch once the user has typed something to confirm.
	const confirmMismatch =
		value.confirm.length > 0 && value.confirm !== value.password;

	return (
		<Box sx={{ maxWidth: 540 }}>
			<StepHeading
				title={t('reg.register.title')}
				subtitle={t('reg.register.subtitle')}
			/>

			{/* Username */}
			<TextField
				value={value.username}
				onChange={(e) =>
					onChange({
						...value,
						// Match the production flow: lowercase only, numbers, "_" and "-".
						username: normalizeUsername(e.target.value)
					})
				}
				placeholder={t('reg.register.username')}
				helperText={t('reg.register.usernameHint')}
				fullWidth
				autoComplete="username"
				inputProps={{
					'aria-label': t('reg.register.username'),
					'autoCapitalize': 'none'
				}}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<PersonOutlineIcon
								sx={{ color: md3.onSurfaceVariant }}
							/>
						</InputAdornment>
					),
					sx: { borderRadius: '12px', bgcolor: '#fff', fontSize: 17 }
				}}
				sx={{ mb: 1 }}
			/>

			{/* Password */}
			<TextField
				value={value.password}
				onChange={(e) =>
					onChange({ ...value, password: e.target.value })
				}
				placeholder={t('reg.register.password')}
				type={showPassword ? 'text' : 'password'}
				fullWidth
				autoComplete="new-password"
				inputProps={{ 'aria-label': t('reg.register.password') }}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<LockOutlinedIcon
								sx={{ color: md3.onSurfaceVariant }}
							/>
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								onClick={() => setShowPassword((v) => !v)}
								edge="end"
								aria-label={t(
									showPassword
										? 'reg.register.hidePassword'
										: 'reg.register.showPassword'
								)}
								sx={{ color: md3.onSurfaceVariant }}
							>
								{showPassword ? (
									<VisibilityOffIcon />
								) : (
									<VisibilityIcon />
								)}
							</IconButton>
						</InputAdornment>
					),
					sx: { borderRadius: '12px', bgcolor: '#fff', fontSize: 17 }
				}}
				sx={{ mt: 2 }}
			/>

			{/* Live password-rule checklist */}
			<Box
				component="ul"
				sx={{ listStyle: 'none', m: 0, mt: 1.25, p: 0 }}
			>
				{PASSWORD_RULES.map((rule) => {
					const passed = rule.test(value.password);
					return (
						<Box
							component="li"
							key={rule.labelKey}
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1,
								mb: 0.5
							}}
						>
							{passed ? (
								<CheckCircleRoundedIcon
									sx={{ fontSize: 18, color: md3.primary }}
								/>
							) : (
								<RadioButtonUncheckedIcon
									sx={{ fontSize: 18, color: md3.outline }}
								/>
							)}
							<Typography
								variant="body2"
								sx={{
									color: passed
										? md3.onSurface
										: md3.onSurfaceVariant
								}}
							>
								{t(rule.labelKey)}
							</Typography>
						</Box>
					);
				})}
			</Box>

			{/* Confirm password */}
			<TextField
				value={value.confirm}
				onChange={(e) =>
					onChange({ ...value, confirm: e.target.value })
				}
				placeholder={t('reg.register.confirm')}
				type={showConfirm ? 'text' : 'password'}
				error={confirmMismatch}
				helperText={
					confirmMismatch ? t('reg.register.mismatch') : undefined
				}
				fullWidth
				autoComplete="new-password"
				inputProps={{ 'aria-label': t('reg.register.confirm') }}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<LockOutlinedIcon
								sx={{ color: md3.onSurfaceVariant }}
							/>
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								onClick={() => setShowConfirm((v) => !v)}
								edge="end"
								aria-label={t(
									showConfirm
										? 'reg.register.hidePassword'
										: 'reg.register.showPassword'
								)}
								sx={{ color: md3.onSurfaceVariant }}
							>
								{showConfirm ? (
									<VisibilityOffIcon />
								) : (
									<VisibilityIcon />
								)}
							</IconButton>
						</InputAdornment>
					),
					sx: { borderRadius: '12px', bgcolor: '#fff', fontSize: 17 }
				}}
				sx={{ mt: 2 }}
			/>

			{/* Privacy consent — inline link composed from before/link/after keys */}
			<FormControlLabel
				sx={{ mt: 2.5, alignItems: 'flex-start', mr: 0 }}
				control={
					<Checkbox
						checked={value.privacy}
						onChange={(e) =>
							onChange({ ...value, privacy: e.target.checked })
						}
						sx={{ pt: 0, color: md3.outline }}
					/>
				}
				label={
					<Typography
						variant="body2"
						sx={{ color: md3.onSurfaceVariant }}
					>
						{t('reg.register.privacyBefore')}
						<Link
							href="#"
							underline="always"
							sx={{ color: md3.primary }}
							onClick={(e) => e.preventDefault()}
						>
							{t('reg.register.privacyLink')}
						</Link>
						{t('reg.register.privacyAfter')}
					</Typography>
				}
			/>
		</Box>
	);
}
