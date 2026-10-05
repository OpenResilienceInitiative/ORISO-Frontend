import { Link } from 'react-router-dom';
import { getChatRecoveryPolicy } from '../../services/chatRecoveryPolicy';
import {
	changePasswordWithRecovery,
	PasswordRecoveryRepairBlockedError,
	PasswordRecoveryRepairRequiredError,
	PasswordRecoveryWorkLimitError
} from '../../services/matrixPasswordRecoveryService';
import { getMatrixClientService } from '../../services/matrixClientRegistry';
import { withRecoverySetupLock } from '../../services/pendingRecoveryKeyStore';
import * as React from 'react';
import { useState, useContext } from 'react';
import { InputField, InputFieldItem } from '../inputField/InputField';
import { apiUpdatePassword, FETCH_ERRORS } from '../../api';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { Button, BUTTON_TYPES } from '../button/Button';
import { logout } from '../logout/logout';
import {
	inputValuesFit,
	strengthIndicator,
	validatePasswordCriteria
} from '../../utils/validateInputValue';
import {
	AccountSetupField,
	CheckMarkIcon,
	PendingDotIcon
} from '../twoFactorAuth/accountSetupDialogChrome';
import { ReactComponent as ShowPasswordIcon } from '../../resources/img/icons/eye.svg';
import { ReactComponent as HidePasswordIcon } from '../../resources/img/icons/eye-closed.svg';
import { CheckAnimation } from '../animatedIllustration/AnimatedIllustration';
import './passwordReset.styles';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';
import { apiUpdatePasswordAppointments } from '../../api/apiUpdatePasswordAppointments';
import {
	ACCOUNT_SETUP_STEPS,
	resolveAccountSetupStep
} from '../twoFactorAuth/accountSetupStep';

/**
 * The chat identity this password change would have to rotate key-backup
 * material through is not reachable. Distinct from a rejected password: the
 * credentials were never tried, and nothing changed.
 */
class ChatRecoveryUnavailableError extends Error {}

/**
 * The Matrix client, or `null` when there is none to be had — no chat identity, the homeserver
 * down, or the client never finished syncing. The caller decides what that means.
 */
const getReadyRecoveryClient = async () => {
	try {
		return (await getMatrixClientService()?.getReadyClient()) ?? null;
	} catch {
		return null;
	}
};

const passwordChangeErrorKey = (
	error: unknown,
	passwordRecoveryEnabled: boolean
): string => {
	if (error instanceof PasswordRecoveryRepairRequiredError)
		return 'encryption.passwordRecovery.repairRequired';
	if (error instanceof PasswordRecoveryRepairBlockedError)
		return 'encryption.passwordRecovery.repairBlocked';
	if (error instanceof PasswordRecoveryWorkLimitError)
		return 'encryption.passwordRecovery.retryable-failure';
	if (error instanceof ChatRecoveryUnavailableError)
		return 'encryption.passwordRecovery.chatUnavailable';
	return passwordRecoveryEnabled
		? 'encryption.passwordRecovery.passwordChangeFailed'
		: 'profile.functions.password.reset.old.incorrect';
};

interface PasswordResetProps {
	/** Inside the account-setup dialog the surrounding dialog already carries the title and the
	 *  reason, and "if you like, you can change your password" would contradict it. */
	hideIntro?: boolean;
	/** `dialog` is the account-setup presentation; the profile page keeps its own form. */
	variant?: 'profile' | 'dialog';
}

interface DialogPasswordFieldProps {
	errorMessage?: string;
	hint?: string;
	id: string;
	label: string;
	name: string;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	successMessage?: string;
	value: string;
}

/** The shared dialog field plus the show/hide toggle only a password needs. */
const DialogPasswordField = ({
	errorMessage,
	hint,
	id,
	label,
	name,
	onChange,
	successMessage,
	value
}: DialogPasswordFieldProps) => {
	const { t: translate } = useTranslation();
	const [isVisible, setIsVisible] = useState(false);

	return (
		<AccountSetupField
			adornment={
				<button
					aria-label={translate(
						isVisible
							? 'login.password.hide'
							: 'login.password.show'
					)}
					className="setupField__adornment"
					onClick={() => setIsVisible(!isVisible)}
					type="button"
				>
					{isVisible ? <HidePasswordIcon /> : <ShowPasswordIcon />}
				</button>
			}
			errorMessage={errorMessage}
			hint={hint}
			id={id}
			label={label}
			name={name}
			onChange={onChange}
			successMessage={successMessage}
			type={isVisible ? 'text' : 'password'}
			value={value}
		/>
	);
};

export const PasswordReset = ({
	hideIntro = false,
	variant = 'profile'
}: PasswordResetProps) => {
	const { t: translate } = useTranslation();
	const { featureAppointmentsEnabled } = getTenantSettings();
	const { userData } = useContext(UserDataContext);
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);

	const settings = useAppConfig();

	const [repairRequired, setRepairRequired] = useState(false);
	const [oldPassword, setOldPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const [oldPasswordErrorMessage, setOldPasswordErrorMessage] = useState('');
	const [oldPasswordSuccessMessage] = useState('');
	const [newPasswordErrorMessage, setNewPasswordErrorMessage] = useState('');
	const [newPasswordSuccessMessage, setNewPasswordSuccessMessage] =
		useState('');
	const [confirmPasswordErrorMessage, setConfirmPasswordErrorMessage] =
		useState('');
	const [confirmPasswordSuccessMessage, setConfirmPasswordSuccessMessage] =
		useState('');

	const [overlayActive, setOverlayActive] = useState(false);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);

	const overlayItem: OverlayItem = {
		svg: CheckAnimation,
		headline: translate(
			'profile.functions.password.reset.overlay.headline'
		),
		buttonSet: [
			{
				label: translate(
					'profile.functions.password.reset.overlay.button.label'
				),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.AUTO_CLOSE
			}
		]
	};

	const getClassNames = (invalid, valid) => {
		let classNames = ['passwordReset__input'];
		if (invalid) {
			classNames.push('passwordReset__input--red');
		}
		if (valid) {
			classNames.push('passwordReset__input--green');
		}
		return classNames.join(' ');
	};

	const inputOldPassword: InputFieldItem = {
		name: 'passwordResetOld',
		class: getClassNames(
			!!oldPasswordErrorMessage,
			!!oldPasswordSuccessMessage
		),
		id: 'passwordResetOld',
		type: 'password',
		label: translate('profile.functions.password.reset.old.label'),
		infoText:
			oldPasswordErrorMessage || oldPasswordSuccessMessage
				? `${oldPasswordErrorMessage} ${oldPasswordSuccessMessage}`
				: '',
		content: oldPassword
	};

	const inputNewPassword: InputFieldItem = {
		name: 'passwordResetNew',
		class: getClassNames(
			!!newPasswordErrorMessage,
			!!newPasswordSuccessMessage
		),
		id: 'passwordResetNew',
		type: 'password',
		label: translate('profile.functions.password.reset.new.label'),
		infoText:
			newPasswordErrorMessage || newPasswordSuccessMessage
				? `${newPasswordErrorMessage} ${newPasswordSuccessMessage}<br>`
				: '',
		content: newPassword
	};

	const inputConfirmPassword: InputFieldItem = {
		name: 'passwordResetConfirm',
		class: getClassNames(
			!!confirmPasswordErrorMessage,
			!!confirmPasswordSuccessMessage
		),
		id: 'passwordResetConfirm',
		type: 'password',
		label: translate('profile.functions.password.reset.confirm.label'),
		infoText:
			confirmPasswordErrorMessage || confirmPasswordSuccessMessage
				? `${confirmPasswordErrorMessage} ${confirmPasswordSuccessMessage}`
				: '',
		content: confirmPassword
	};

	const handleInputOldChange = (event) => {
		setOldPasswordErrorMessage('');
		setOldPassword(event.target.value);
		validateNewPassword(newPassword, event.target.value);
	};

	const handleInputNewChange = (event) => {
		validateNewPassword(event.target.value);
		validateConfirmPassword(confirmPassword, event.target.value);
		setNewPassword(event.target.value);
	};

	const handleInputConfirmChange = (event) => {
		validateConfirmPassword(event.target.value, newPassword);
		setConfirmPassword(event.target.value);
	};

	const validateNewPassword = (
		newPassword: string,
		currentPassword: string = oldPassword
	) => {
		let passwordStrength = strengthIndicator(newPassword);
		if (newPassword.length >= 1 && newPassword === currentPassword) {
			// A "change" to the same password would leave the account on the one its
			// administrator knows. The server refuses it too; this says so before the round trip.
			setNewPasswordSuccessMessage('');
			setNewPasswordErrorMessage(
				translate('profile.functions.password.reset.sameAsOld')
			);
		} else if (newPassword.length >= 1 && passwordStrength < 4) {
			setNewPasswordSuccessMessage('');
			setNewPasswordErrorMessage(
				translate('profile.functions.password.reset.insecure')
			);
		} else if (newPassword.length >= 1) {
			setNewPasswordSuccessMessage(
				translate('profile.functions.password.reset.secure')
			);
			setNewPasswordErrorMessage('');
		} else {
			setNewPasswordSuccessMessage('');
			setNewPasswordErrorMessage('');
		}
	};

	const isValid =
		!(!!newPasswordErrorMessage && !!confirmPasswordErrorMessage) &&
		!!newPasswordSuccessMessage &&
		!!confirmPasswordSuccessMessage;

	const validateConfirmPassword = (
		confirmPassword: string,
		newPassword: string
	) => {
		let passwordFits = inputValuesFit(confirmPassword, newPassword);
		if (confirmPassword.length >= 1 && !passwordFits) {
			setConfirmPasswordSuccessMessage('');
			setConfirmPasswordErrorMessage(
				translate('profile.functions.password.reset.not.same')
			);
		} else if (confirmPassword.length >= 1) {
			setConfirmPasswordSuccessMessage(
				translate('profile.functions.password.reset.same')
			);
			setConfirmPasswordErrorMessage('');
		} else {
			setConfirmPasswordSuccessMessage('');
			setConfirmPasswordErrorMessage('');
		}
	};

	const handleSubmit = () => {
		if (isRequestInProgress) {
			return null;
		}

		if (isValid) {
			setIsRequestInProgress(true);
			setRepairRequired(false);
			setOldPasswordErrorMessage('');

			(async () => {
				const policy = getChatRecoveryPolicy(
					userData,
					hasUserAuthority(AUTHORITIES.ANONYMOUS_DEFAULT, userData)
				);
				if (policy.mode === 'RECOVERY_KEY')
					return apiUpdatePassword(oldPassword, newPassword);
				/* The account-setup gate's own step. `passwordChangeRequired`
				   is set exactly once — when an administrator provisions the
				   account — so this is the account's FIRST password change:
				   the old password is the administrator's, nothing of the
				   counsellor's own is sealed under it, and there is no
				   key-backup material of theirs to rotate. The gate offers no
				   way on but logging out, so this step must not be able to
				   dead-end (#1481). */
				const firstChange =
					resolveAccountSetupStep(userData) ===
					ACCOUNT_SETUP_STEPS.PASSWORD;
				const client = await getReadyRecoveryClient();
				const id = client?.getUserId();
				if (!client || !id) {
					/* Nothing was ever sealed, so a plain update loses
					   nothing. For an established account it would: the
					   envelope would stay sealed under the old password and
					   the counsellor's history would need a recovery key they
					   may never have saved. Refuse, and say so. */
					if (firstChange)
						return apiUpdatePassword(oldPassword, newPassword);
					throw new ChatRecoveryUnavailableError();
				}
				try {
					await withRecoverySetupLock(id, () =>
						changePasswordWithRecovery(
							client,
							oldPassword,
							newPassword,
							() => apiUpdatePassword(oldPassword, newPassword),
							(error) =>
								error instanceof Error &&
								error.message === FETCH_ERRORS.BAD_REQUEST
						)
					);
				} catch (error) {
					/* No envelope exists at all — thrown before the password
					   API is ever called, so there is no double change to
					   fear. Outside the gate this points at the security
					   settings; behind it those are unreachable, and there is
					   still nothing to rotate. */
					if (
						firstChange &&
						error instanceof PasswordRecoveryRepairRequiredError
					)
						return apiUpdatePassword(oldPassword, newPassword);
					throw error;
				}
			})()
				.then(async () => {
					// Must complete BEFORE logout clears the auth cookies —
					// otherwise the appointments-password update races the
					// session invalidation and dies with a 401 (stale
					// appointments/CalDAV password). A failure must not block
					// the logout itself.
					if (isConsultant && featureAppointmentsEnabled) {
						await apiUpdatePasswordAppointments(
							userData.email,
							newPassword
						).catch(() => {
							// keep the logout flowing; the appointments
							// password can be re-synced on next login
						});
					}

					setOldPassword('');
					setNewPassword('');
					setConfirmPassword('');
					setOverlayActive(true);
					setIsRequestInProgress(false);
					logout(false, settings.urls.toLogin);
				})
				.catch((error) => {
					setRepairRequired(
						error instanceof PasswordRecoveryRepairRequiredError
					);
					// error handling for password update error
					setOldPasswordErrorMessage(
						translate(
							passwordChangeErrorKey(
								error,
								userData.chatRecoveryMode === 'LOGIN_PASSWORD'
							)
						)
					);
					setIsRequestInProgress(false);
				});
		}
	};

	const handleSuccess = () => {
		window.location.href = settings.urls.toLogin;
	};

	if (variant === 'dialog') {
		// Live checklist: each rule turns green as the typed password meets it.
		const criteria = validatePasswordCriteria(newPassword);
		const criteriaItems = [
			{
				key: 'mixedCase',
				isMet: criteria.hasUpperLowerCase,
				labelKey: 'profile.functions.password.reset.criteria.mixedCase'
			},
			{
				key: 'number',
				isMet: criteria.hasNumber,
				labelKey: 'profile.functions.password.reset.criteria.number'
			},
			{
				key: 'specialChar',
				isMet: criteria.hasSpecialChar,
				labelKey:
					'profile.functions.password.reset.criteria.specialChar'
			},
			{
				key: 'minLength',
				isMet: criteria.hasMinLength,
				labelKey: 'profile.functions.password.reset.criteria.minLength'
			}
		];

		return (
			<div
				id="passwordReset"
				className="passwordReset passwordReset--dialog"
			>
				{repairRequired && (
					<p className="passwordReset__error" role="alert">
						{translate(
							'encryption.passwordRecovery.repairRequired'
						)}{' '}
						<Link to="/profile/einstellungen/sicherheit">
							{translate('encryption.passwordRecovery.settings')}
						</Link>
					</p>
				)}
				<DialogPasswordField
					errorMessage={oldPasswordErrorMessage}
					hint={translate(
						'profile.functions.password.reset.old.hint'
					)}
					id="passwordResetOld"
					label={translate(
						'profile.functions.password.reset.old.dialogLabel'
					)}
					name="passwordResetOld"
					onChange={handleInputOldChange}
					successMessage={oldPasswordSuccessMessage}
					value={oldPassword}
				/>
				<div className="passwordReset__fieldPair">
					<DialogPasswordField
						errorMessage={newPasswordErrorMessage}
						id="passwordResetNew"
						label={translate(
							'profile.functions.password.reset.new.label'
						)}
						name="passwordResetNew"
						onChange={handleInputNewChange}
						successMessage={newPasswordSuccessMessage}
						value={newPassword}
					/>
					<DialogPasswordField
						errorMessage={confirmPasswordErrorMessage}
						id="passwordResetConfirm"
						label={translate(
							'profile.functions.password.reset.confirm.dialogLabel'
						)}
						name="passwordResetConfirm"
						onChange={handleInputConfirmChange}
						successMessage={confirmPasswordSuccessMessage}
						value={confirmPassword}
					/>
				</div>
				<div className="passwordReset__criteria">
					<p className="passwordReset__criteriaTitle">
						{translate(
							'profile.functions.password.reset.criteria.title'
						)}
					</p>
					<ul className="passwordReset__criteriaList">
						{criteriaItems.map((item) => (
							<li
								className={[
									'passwordReset__criterion',
									item.isMet &&
										'passwordReset__criterion--met'
								]
									.filter(Boolean)
									.join(' ')}
								key={item.key}
							>
								{item.isMet ? (
									<CheckMarkIcon size={16} />
								) : (
									<PendingDotIcon />
								)}
								<span>{translate(item.labelKey)}</span>
								{item.isMet && (
									<span className="twoFactorSetupDialog__srOnly">
										{` ${translate('profile.functions.password.reset.criteria.met')}`}
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
				<Button
					item={{
						label: translate(
							'profile.functions.password.reset.submitAndContinue'
						),
						type: BUTTON_TYPES.PRIMARY
					}}
					buttonHandle={handleSubmit}
					className="passwordReset__submit"
					disabled={!isValid}
				/>
				{overlayActive ? (
					<Overlay item={overlayItem} handleOverlay={handleSuccess} />
				) : null}
			</div>
		);
	}

	return (
		<div id="passwordReset" className="passwordReset">
			{!hideIntro && (
				<div className="profile__content__title">
					<Headline
						text={translate(
							'profile.functions.password.reset.title'
						)}
						semanticLevel="5"
					/>
					<Text
						text={translate(
							'profile.functions.password.reset.subtitle'
						)}
						type="standard"
						className="tertiary"
					/>
				</div>
			)}
			<div className="generalInformation">
				{repairRequired && (
					<p role="alert">
						{translate(
							'encryption.passwordRecovery.repairRequired'
						)}{' '}
						<Link to="/profile/einstellungen/sicherheit">
							{translate('encryption.passwordRecovery.settings')}
						</Link>
					</p>
				)}
				<div className="flex">
					<div className="flex__col--1 flex-xl__col--50p">
						<div className="pr-xl--1">
							<InputField
								item={inputOldPassword}
								inputHandle={handleInputOldChange}
							/>
						</div>
					</div>
				</div>

				<div
					className="tertiary pb--1"
					dangerouslySetInnerHTML={{
						__html: translate(
							'profile.functions.password.reset.instructions'
						)
					}}
				></div>

				<div className="flex flex--fd-column flex-xl--fd-row">
					<div className="flex__col">
						<div className="pr-xl--1">
							<InputField
								item={inputNewPassword}
								inputHandle={handleInputNewChange}
							/>
						</div>
					</div>
					<div className="flex__col">
						<div className="pl-xl--1">
							<InputField
								item={inputConfirmPassword}
								inputHandle={handleInputConfirmChange}
							/>
						</div>
					</div>
				</div>

				<div className="button__wrapper">
					<Button
						item={{
							label: translate(
								'profile.functions.security.button'
							),
							type: 'LINK'
						}}
						buttonHandle={handleSubmit}
						className={'passwordReset__button'}
						disabled={!isValid}
					/>
				</div>
			</div>
			{overlayActive ? (
				<Overlay item={overlayItem} handleOverlay={handleSuccess} />
			) : null}
		</div>
	);
};
