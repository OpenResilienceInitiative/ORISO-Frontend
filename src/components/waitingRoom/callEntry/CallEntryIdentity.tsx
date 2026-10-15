import * as React from 'react';
import { useState } from 'react';
import { Box, IconButton, InputAdornment } from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { OrisoTextField } from '../../form/OrisoTextField';
import { PasswordRuleChips } from '../../registration/accountData/PasswordRuleChips';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { callEntryCopy as copy } from './callEntryCopy';

/**
 * `enter`: a password the person already has (from the invitation or their
 * account). `set`: a first-time guest chooses one, with the registration's
 * own rule chips. Which one the call link uses is still open (#1386).
 */
export type CallPasswordMode = 'enter' | 'set';

export interface CallEntryIdentityProps {
	name: string;
	onNameChange: (name: string) => void;
	password: string;
	onPasswordChange: (password: string) => void;
	passwordMode: CallPasswordMode;
	passwordError?: string;
}

const adornmentIconSx = { color: registrationMd3.onSurfaceVariant };

/** Name and password, the same fields and icons as the registration. */
export const CallEntryIdentity = ({
	name,
	onNameChange,
	password,
	onPasswordChange,
	passwordMode,
	passwordError
}: CallEntryIdentityProps) => {
	const [visible, setVisible] = useState(false);
	return (
		<Box data-testid="call-entry-identity">
			<OrisoTextField
				value={name}
				onChange={(event) => onNameChange(event.target.value)}
				label={copy.nameLabel}
				helperText={copy.nameHelper}
				fullWidth
				autoComplete="nickname"
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<PersonOutlineRoundedIcon sx={adornmentIconSx} />
						</InputAdornment>
					)
				}}
				sx={{ mt: 0 }}
			/>
			<OrisoTextField
				value={password}
				onChange={(event) => onPasswordChange(event.target.value)}
				label={copy.passwordLabel[passwordMode]}
				helperText={passwordError ?? copy.passwordHelper[passwordMode]}
				error={Boolean(passwordError)}
				type={visible ? 'text' : 'password'}
				required
				fullWidth
				autoComplete={
					passwordMode === 'set' ? 'new-password' : 'current-password'
				}
				InputProps={{
					startAdornment: (
						<InputAdornment position="start">
							<VpnKeyOutlinedIcon sx={adornmentIconSx} />
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position="end">
							<IconButton
								edge="end"
								onClick={() => setVisible(!visible)}
								aria-label={
									visible
										? copy.hidePassword
										: copy.showPassword
								}
								title={
									visible
										? copy.hidePassword
										: copy.showPassword
								}
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
			{passwordMode === 'set' && (
				<PasswordRuleChips password={password} />
			)}
		</Box>
	);
};
