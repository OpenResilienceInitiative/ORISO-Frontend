import * as React from 'react';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InputAdornment, IconButton } from '@mui/material';
import { StageLayout } from '../stageLayout/StageLayout';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { Text } from '../text/Text';
import { OrisoTextField } from '../form/OrisoTextField';
import { orisoInputColors } from '../form/orisoInputDesign';
import { ReactComponent as LockIcon } from '../../resources/img/icons/lock.svg';
import { ReactComponent as ShowPasswordIcon } from '../../resources/img/icons/eye.svg';
import { ReactComponent as HidePasswordIcon } from '../../resources/img/icons/eye-closed.svg';
import { ReactComponent as CheckIcon } from '../../resources/img/illustrations/check.svg';
import { apiConfirmPasswordReset } from '../../api/apiConfirmPasswordReset';
import {
	inputValuesFit,
	strengthIndicator
} from '../../utils/validateInputValue';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import useIsFirstVisit from '../../utils/useIsFirstVisit';
import { UrlParamsContext } from '../../globalState/provider/UrlParamsProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useSearchParam } from '../../hooks/useSearchParams';
import '../login/login.styles';
import './requestPasswordReset.styles';

export const SetNewPassword = () => {
	const { t: translate } = useTranslation();
	const { Stage } = useContext(GlobalComponentContext);
	const { loaded: isReady } = useContext(UrlParamsContext);
	const isFirstVisit = useIsFirstVisit();
	const settings = useAppConfig();
	const token = useSearchParam<string>('token');

	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [newPasswordMessage, setNewPasswordMessage] = useState('');
	const [newPasswordValid, setNewPasswordValid] = useState(false);
	const [confirmPasswordMessage, setConfirmPasswordMessage] = useState('');
	const [confirmPasswordValid, setConfirmPasswordValid] = useState(false);
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [isSuccess, setIsSuccess] = useState(false);

	const submitButton: ButtonItem = {
		label: translate('login.resetPassword.setNew.submitLabel'),
		type: BUTTON_TYPES.PRIMARY
	};

	const validateNewPassword = (value: string) => {
		const passwordStrength = strengthIndicator(value);
		if (value.length >= 1 && passwordStrength < 4) {
			setNewPasswordValid(false);
			setNewPasswordMessage(
				translate('profile.functions.password.reset.insecure')
			);
		} else if (value.length >= 1) {
			setNewPasswordValid(true);
			setNewPasswordMessage(
				translate('profile.functions.password.reset.secure')
			);
		} else {
			setNewPasswordValid(false);
			setNewPasswordMessage('');
		}
	};

	const validateConfirmPassword = (value: string, against: string) => {
		const fits = inputValuesFit(value, against);
		if (value.length >= 1 && !fits) {
			setConfirmPasswordValid(false);
			setConfirmPasswordMessage(
				translate('profile.functions.password.reset.not.same')
			);
		} else if (value.length >= 1) {
			setConfirmPasswordValid(true);
			setConfirmPasswordMessage(
				translate('profile.functions.password.reset.same')
			);
		} else {
			setConfirmPasswordValid(false);
			setConfirmPasswordMessage('');
		}
	};

	const handleNewPasswordChange = (event) => {
		const value = event.target.value;
		setNewPassword(value);
		validateNewPassword(value);
		validateConfirmPassword(confirmPassword, value);
	};

	const handleConfirmPasswordChange = (event) => {
		const value = event.target.value;
		setConfirmPassword(value);
		validateConfirmPassword(value, newPassword);
	};

	const isValid = newPasswordValid && confirmPasswordValid;

	const handleSubmit = async () => {
		if (!isValid || isRequestInProgress || !token) {
			return;
		}
		setIsRequestInProgress(true);
		setErrorMessage('');
		try {
			await apiConfirmPasswordReset(token, newPassword);
			setIsSuccess(true);
		} catch (error) {
			setErrorMessage(
				translate('login.resetPassword.setNew.invalidToken')
			);
		} finally {
			setIsRequestInProgress(false);
		}
	};

	const handleKeyUp = (e) => {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	};

	return (
		<StageLayout
			stage={<Stage hasAnimation={isFirstVisit} isReady={isReady} />}
			showLegalLinks
		>
			<div className="loginForm">
				<div className="loginForm__inner">
					{!token ? (
						<>
							<div className="loginForm__headline">
								<h2>
									{translate(
										'login.resetPassword.setNew.headline'
									)}
								</h2>
							</div>
							<Text
								text={translate(
									'login.resetPassword.setNew.invalidToken'
								)}
								type="standard"
							/>
							<div className="loginForm__actions">
								<button
									onClick={() =>
										window.open('/password-reset', '_self')
									}
									className="button-as-link"
									type="button"
								>
									{translate(
										'login.resetPassword.backToLogin'
									)}
								</button>
							</div>
						</>
					) : isSuccess ? (
						<>
							<div className="requestPasswordReset__icon">
								<CheckIcon />
							</div>
							<div className="loginForm__headline">
								<h2>
									{translate(
										'profile.functions.password.reset.overlay.headline'
									)}
								</h2>
							</div>
							<Text
								text={translate(
									'login.resetPassword.setNew.success'
								)}
								type="standard"
							/>
							<div className="loginForm__actions">
								<Button
									item={{
										label: translate(
											'profile.functions.password.reset.overlay.button.label'
										),
										type: BUTTON_TYPES.PRIMARY
									}}
									buttonHandle={() =>
										window.open(
											settings.urls.toLogin,
											'_self'
										)
									}
								/>
							</div>
						</>
					) : (
						<>
							<div className="loginForm__headline">
								<h2>
									{translate(
										'login.resetPassword.setNew.headline'
									)}
								</h2>
							</div>
							<Text
								text={translate(
									'login.resetPassword.setNew.text'
								)}
								type="standard"
							/>
							<div
								className="tertiary pb--1 requestPasswordReset__instructions"
								dangerouslySetInnerHTML={{
									__html: translate(
										'profile.functions.password.reset.instructions'
									)
								}}
							></div>
							<div className="loginForm__fields">
								<OrisoTextField
									id="newPassword"
									name="newPassword"
									type={
										isPasswordVisible ? 'text' : 'password'
									}
									value={newPassword}
									onChange={handleNewPasswordChange}
									onKeyUp={handleKeyUp}
									placeholder={translate(
										'login.resetPassword.setNew.newLabel'
									)}
									helperText={newPasswordMessage}
									fullWidth
									autoComplete="new-password"
									autoFocus
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<LockIcon
													color={
														orisoInputColors.onSurfaceVariant
													}
												/>
											</InputAdornment>
										),
										endAdornment: (
											<InputAdornment position="end">
												<IconButton
													type="button"
													onMouseDown={(event) =>
														event.preventDefault()
													}
													onClick={() =>
														setIsPasswordVisible(
															(visible) =>
																!visible
														)
													}
													edge="end"
													aria-label={translate(
														isPasswordVisible
															? 'login.password.hide'
															: 'login.password.show'
													)}
												>
													{isPasswordVisible ? (
														<HidePasswordIcon
															color={
																orisoInputColors.onSurfaceVariant
															}
														/>
													) : (
														<ShowPasswordIcon
															color={
																orisoInputColors.onSurfaceVariant
															}
														/>
													)}
												</IconButton>
											</InputAdornment>
										)
									}}
									sx={{ mb: '20px' }}
								/>
								<OrisoTextField
									id="confirmPassword"
									name="confirmPassword"
									type={
										isPasswordVisible ? 'text' : 'password'
									}
									value={confirmPassword}
									onChange={handleConfirmPasswordChange}
									onKeyUp={handleKeyUp}
									placeholder={translate(
										'login.resetPassword.setNew.confirmLabel'
									)}
									helperText={confirmPasswordMessage}
									fullWidth
									autoComplete="new-password"
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<LockIcon
													color={
														orisoInputColors.onSurfaceVariant
													}
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
									buttonHandle={handleSubmit}
									disabled={!isValid || isRequestInProgress}
								/>
							</div>
						</>
					)}
				</div>
			</div>
		</StageLayout>
	);
};
