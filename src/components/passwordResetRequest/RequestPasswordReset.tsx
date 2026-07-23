import * as React from 'react';
import { useContext, useState } from 'react';
import { StageLayout } from '../stageLayout/StageLayout';
import { RequestPasswordResetFormView } from './RequestPasswordResetFormView';
import { PasswordResetSentView } from './PasswordResetSentView';
import { apiRequestPasswordReset } from '../../api/apiRequestPasswordReset';
import { FETCH_ERRORS } from '../../api/fetchData';
import { LocaleContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useTranslation } from 'react-i18next';
import '../login/login.styles';
import './requestPasswordReset.styles';

export const RequestPasswordReset = () => {
	const { t: translate } = useTranslation();
	const { locale } = useContext(LocaleContext);
	const { Stage } = useContext(GlobalComponentContext);
	const { loaded: isReady } = useContext(UrlParamsContext);
	const isFirstVisit = useIsFirstVisit();
	const settings = useAppConfig();

	const [username, setUsername] = useState('');
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [sentToUsername, setSentToUsername] = useState('');

	const handleUsernameChange = (event) => {
		setUsername(event.target.value);
		setErrorMessage('');
	};

	const handleBackToLogin = () => {
		window.open(settings.urls.toLogin, '_self');
	};

	const handleSubmit = async () => {
		const trimmed = username.trim();
		if (!trimmed) {
			setErrorMessage(
				translate('login.resetPassword.request.usernameRequired')
			);
			return;
		}
		if (isRequestInProgress) {
			return;
		}
		setIsRequestInProgress(true);
		setErrorMessage('');
		try {
			await apiRequestPasswordReset(trimmed, locale);
			setSentToUsername(trimmed);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === FETCH_ERRORS.FORBIDDEN
			) {
				setErrorMessage(
					translate('login.resetPassword.request.notEnabled')
				);
			} else {
				setErrorMessage(
					translate('login.warning.failed.unauthorized.text')
				);
			}
		} finally {
			setIsRequestInProgress(false);
		}
	};

	return (
		<StageLayout
			stage={<Stage hasAnimation={isFirstVisit} isReady={isReady} />}
			showLegalLinks
		>
			<div className="loginForm">
				<div className="loginForm__inner">
					{sentToUsername ? (
						<PasswordResetSentView
							username={sentToUsername}
							onBackToLogin={handleBackToLogin}
						/>
					) : (
						<RequestPasswordResetFormView
							username={username}
							onUsernameChange={handleUsernameChange}
							onSubmit={handleSubmit}
							onBackToLogin={handleBackToLogin}
							disabled={!username.trim() || isRequestInProgress}
							errorMessage={errorMessage}
						/>
					)}
				</div>
			</div>
		</StageLayout>
	);
};
