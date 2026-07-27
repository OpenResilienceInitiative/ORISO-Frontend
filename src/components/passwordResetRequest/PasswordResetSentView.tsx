import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../text/Text';
import { ReactComponent as EnvelopeCheckIcon } from '../../resources/img/illustrations/envelope-check.svg';

export interface PasswordResetSentViewProps {
	username: string;
	onBackToLogin: () => void;
}

export const PasswordResetSentView = ({
	username,
	onBackToLogin
}: PasswordResetSentViewProps) => {
	const { t: translate } = useTranslation();

	return (
		<>
			<div className="requestPasswordReset__icon">
				<EnvelopeCheckIcon />
			</div>
			<div className="loginForm__headline">
				<h2>{translate('login.resetPassword.sent.headline')}</h2>
			</div>
			<Text
				text={translate('login.resetPassword.sent.text', {
					username
				})}
				type="standard"
			/>
			<div className="loginForm__actions">
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
