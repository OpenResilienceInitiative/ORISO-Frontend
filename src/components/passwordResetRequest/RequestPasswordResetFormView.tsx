import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { InputAdornment } from '@mui/material';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { Text } from '../text/Text';
import { OrisoTextField } from '../form/OrisoTextField';
import { orisoInputColors } from '../form/orisoInputDesign';
import { ReactComponent as PersonIcon } from '../../resources/img/icons/person.svg';

export interface RequestPasswordResetFormViewProps {
	username: string;
	onUsernameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onSubmit: () => void;
	onBackToLogin: () => void;
	disabled?: boolean;
	errorMessage?: string;
}

export const RequestPasswordResetFormView = ({
	username,
	onUsernameChange,
	onSubmit,
	onBackToLogin,
	disabled,
	errorMessage
}: RequestPasswordResetFormViewProps) => {
	const { t: translate } = useTranslation();

	const submitButton: ButtonItem = {
		label: translate('login.resetPassword.request.submitLabel'),
		type: BUTTON_TYPES.PRIMARY
	};

	const handleKeyUp = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			onSubmit();
		}
	};

	return (
		<>
			<div className="loginForm__headline">
				<h2>{translate('login.resetPassword.request.headline')}</h2>
			</div>
			<Text
				className="requestPasswordReset__subtitle"
				text={translate('login.resetPassword.request.text')}
				type="standard"
			/>
			<div className="loginForm__fields">
				<OrisoTextField
					id="username"
					name="username"
					type="text"
					value={username}
					onChange={onUsernameChange}
					onKeyUp={handleKeyUp}
					placeholder={translate(
						'login.resetPassword.request.usernameLabel'
					)}
					error={!!errorMessage}
					fullWidth
					autoComplete="username"
					autoFocus
					inputProps={{
						'aria-label': translate(
							'login.resetPassword.request.usernameLabel'
						)
					}}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<PersonIcon
									color={orisoInputColors.onSurfaceVariant}
								/>
							</InputAdornment>
						)
					}}
					sx={{ mb: '20px' }}
				/>
			</div>
			{errorMessage && (
				<Text
					text={errorMessage}
					type="infoSmall"
					className="loginForm__error"
				/>
			)}
			<div className="loginForm__actions">
				<Button
					item={submitButton}
					buttonHandle={onSubmit}
					disabled={disabled}
				/>
				<button
					onClick={onBackToLogin}
					className="button-as-link"
					type="button"
				>
					{translate('login.resetPassword.backToLogin')}
				</button>
			</div>
		</>
	);
};
