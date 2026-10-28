import * as React from 'react';
import { useState } from 'react';
import { Box, IconButton, InputAdornment, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { OrisoTextField } from '../../form/OrisoTextField';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import { PasswordRuleChips } from '../../registration/accountData/PasswordRuleChips';
import { IdentitySuggestButton } from '../../registration/accountData/IdentitySuggestButton';
import { toRegistrationUsername } from '../../registration/accountData/registrationUsername';
import {
	registrationMd3,
	registrationScreenKickerSx
} from '../../registration/registrationDesign/registrationDesign';
import {
	generateAvatar,
	generatePassword,
	regeneratePseudonym,
	type Pseudonym
} from '../../../utils/pseudonymGenerator';
import genUserIcon from '../../../resources/img/registration-md3/icons/gen-user.svg';
import genKeyIcon from '../../../resources/img/registration-md3/icons/gen-key.svg';
import genAvatarIcon from '../../../resources/img/registration-md3/icons/gen-avatar.svg';
import genDiceIcon from '../../../resources/img/registration-md3/icons/gen-dice.svg';
import { callEntryCopy as copy } from './callEntryCopy';
import { CallModality } from './callEntryTypes';
import type { UsernameFeedback } from '../../registration/accountData/usernameFeedback';

export interface CallEntryIdentityProps {
	modality: CallModality;
	identity: Pseudonym;
	onIdentityChange: (identity: Pseudonym) => void;
	username: string;
	onUsernameChange: (username: string) => void;
	password: string;
	onPasswordChange: (password: string) => void;
	/** The registration's own User-ID feedback (length, taken, retry). */
	usernameFeedback?: UsernameFeedback;
	onUsernameBlur?: () => void;
}

/**
 * Who the person is in the call: the registration's own identity block —
 * animal avatar, the suggest buttons with their icons (User-ID, password,
 * avatar, all three), the User-ID field and a password the guest sets with
 * the rule chips. The avatar is what the others see whenever there is no
 * picture: camera off, or a phone call (Frank, 2026-10-15).
 */
export const CallEntryIdentity = ({
	modality,
	identity,
	onIdentityChange,
	username,
	onUsernameChange,
	password,
	onPasswordChange,
	usernameFeedback,
	onUsernameBlur
}: CallEntryIdentityProps) => {
	const { t, i18n } = useTranslation();
	const locale = i18n.resolvedLanguage ?? 'de';
	const [visible, setVisible] = useState(false);

	const suggestUsername = () => {
		const next = regeneratePseudonym(identity, locale);
		onIdentityChange({ ...next, avatar: identity.avatar });
		onUsernameChange(toRegistrationUsername(next));
	};
	const suggestAvatar = () =>
		onIdentityChange({ ...identity, avatar: generateAvatar(locale) });
	const suggestPassword = () => {
		onPasswordChange(generatePassword());
		setVisible(true);
	};
	const suggestAll = () => {
		const next = regeneratePseudonym(identity, locale);
		onIdentityChange(next);
		onUsernameChange(toRegistrationUsername(next));
		suggestPassword();
	};
	const visibilityLabel = t(
		visible ? 'login.password.hide' : 'login.password.show'
	);

	return (
		<Box data-testid="call-entry-identity">
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
				<Box data-testid="call-entry-avatar" sx={{ flexShrink: 0 }}>
					<AnimalAvatar avatar={identity.avatar} size={64} />
				</Box>
				<Typography
					sx={{
						fontSize: 14,
						lineHeight: '20px',
						color: registrationMd3.onSurfaceVariant
					}}
				>
					{copy.avatarHint[modality]}
				</Typography>
			</Box>

			<Typography sx={{ ...registrationScreenKickerSx, mt: 2.5, mb: 1 }}>
				{t('registration.account.autoSuggest')}
			</Typography>
			{/* The column beside the check is narrower than the registration's,
			    so the four buttons go two by two there instead of truncating. */}
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					gap: 0.75
				}}
			>
				<IdentitySuggestButton
					icon={genUserIcon}
					label={t('registration.account.suggest.username')}
					onClick={suggestUsername}
				/>
				<IdentitySuggestButton
					icon={genKeyIcon}
					label={t('registration.account.suggest.password')}
					onClick={suggestPassword}
				/>
				<IdentitySuggestButton
					icon={genAvatarIcon}
					label={t('registration.account.suggest.avatar')}
					onClick={suggestAvatar}
				/>
				<IdentitySuggestButton
					icon={genDiceIcon}
					label={t('registration.account.suggest.allShort')}
					onClick={suggestAll}
				/>
			</Box>

			<OrisoTextField
				value={username}
				onChange={(event) =>
					onUsernameChange(
						event.target.value
							.toLowerCase()
							.replace(/[^a-z0-9_-]/g, '')
					)
				}
				label={t('registration.account.username.label')}
				helperText={t(
					usernameFeedback?.helperTextKey ??
						'registration.account.username.info'
				)}
				error={usernameFeedback?.hasError}
				onBlur={onUsernameBlur}
				fullWidth
				autoComplete="username"
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
			<OrisoTextField
				value={password}
				onChange={(event) => onPasswordChange(event.target.value)}
				label={t('registration.account.password.label')}
				helperText={copy.passwordHelper}
				type={visible ? 'text' : 'password'}
				required
				fullWidth
				autoComplete="new-password"
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
								edge="end"
								onClick={() => setVisible(!visible)}
								aria-label={visibilityLabel}
								title={visibilityLabel}
							>
								{visible ? (
									<VisibilityOffIcon />
								) : (
									<VisibilityIcon />
								)}
							</IconButton>
						</InputAdornment>
					)
				}}
			/>
			<PasswordRuleChips password={password} />
		</Box>
	);
};
