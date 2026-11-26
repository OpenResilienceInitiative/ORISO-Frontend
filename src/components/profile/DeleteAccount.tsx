import * as React from 'react';
import { useState } from 'react';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { InputField, InputFieldItem } from '../inputField/InputField';
import { Overlay, OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import './deleteAccount.styles';
import { ReactComponent as CheckIllustration } from '../../resources/img/illustrations/check.svg';
import { apiDeleteAskerAccount, FETCH_ERRORS } from '../../api';
import { removeAllCookies } from '../sessionCookie/accessSessionCookie';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	captureMatrixAccountForDeletion,
	clearDeletedMatrixAccountStorage,
	isDeletedAccountSessionCurrent,
	type DeletedMatrixAccount
} from '../../services/matrixAccountStorage';

const RETRY_LOCAL_CLEANUP = 'RETRY_LOCAL_CLEANUP';

export const DeleteAccount = () => {
	const settings = useAppConfig();
	const { t: translate } = useTranslation();

	const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);
	const [password, setPassword] = useState<string>('');
	const [deletion, setDeletion] = useState<{
		account: DeletedMatrixAccount;
		cleanupComplete: boolean;
	} | null>(null);
	const [isPasswordWarningActive, setIsPasswordWarningActive] =
		useState<boolean>(false);
	const [isRequestInProgress, setIsRequestInProgress] =
		useState<boolean>(false);

	const deleteAccountButton: ButtonItem = {
		label: translate('deleteAccount.button.label'),
		type: BUTTON_TYPES.SECONDARY
	};

	const inputItemPassword: InputFieldItem = {
		name: 'password',
		class: 'passwordFields__fieldGroup__input',
		id: 'passwordInput',
		type: 'password',
		label: translate('deleteAccount.confirmOverlay.input.label'),
		content: password,
		warningLabel: translate('deleteAccount.confirmOverlay.input.warning'),
		warningActive: isPasswordWarningActive
	};

	const handlePasswordInput = (e) => {
		setPassword(e.target.value);
		setIsPasswordWarningActive(false);
	};

	const overlayConfirm: OverlayItem = {
		headline: translate('deleteAccount.confirmOverlay.headline'),
		headlineStyleLevel: '1',
		copy: translate('deleteAccount.confirmOverlay.copy'),
		nestedComponent: (
			<>
				<InputField
					item={inputItemPassword}
					inputHandle={handlePasswordInput}
				/>

				{isPasswordWarningActive && (
					<span className="deleteAccount__warning">
						{translate(
							'deleteAccount.confirmOverlay.input.warning'
						)}
					</span>
				)}
			</>
		),
		buttonSet: [
			{
				label: translate('deleteAccount.confirmOverlay.button.confirm'),
				function: OVERLAY_FUNCTIONS.DELETE_ACCOUNT,
				type: BUTTON_TYPES.PRIMARY,
				disabled: password.length === 0 || isRequestInProgress
			},
			{
				label: translate('deleteAccount.confirmOverlay.button.deny'),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.SECONDARY
			}
		]
	};

	const cleanupIncomplete = deletion?.cleanupComplete === false;
	const retryCleanupButton: ButtonItem = {
		label: translate('deleteAccount.successOverlay.retryCleanup'),
		function: RETRY_LOCAL_CLEANUP,
		type: BUTTON_TYPES.PRIMARY,
		disabled: isRequestInProgress
	};
	const overlaySuccess: OverlayItem = {
		headline: translate('deleteAccount.successOverlay.headline'),
		copy: cleanupIncomplete
			? translate('deleteAccount.successOverlay.cleanupIncomplete')
			: undefined,
		svg: cleanupIncomplete ? undefined : CheckIllustration,
		buttonSet: [
			...(cleanupIncomplete && deletion?.account.userId
				? [retryCleanupButton]
				: []),
			{
				label: translate('deleteAccount.successOverlay.button'),
				function: OVERLAY_FUNCTIONS.REDIRECT,
				type: BUTTON_TYPES.SECONDARY,
				disabled: isRequestInProgress
			}
		]
	};

	const finishLocalCleanup = async (account: DeletedMatrixAccount) => {
		try {
			const cleanupComplete =
				await clearDeletedMatrixAccountStorage(account);
			setDeletion({ account, cleanupComplete });
		} catch {
			setDeletion({ account, cleanupComplete: false });
		} finally {
			setIsRequestInProgress(false);
		}
	};

	const handleOverlayAction = async (buttonFunction: string) => {
		if (isRequestInProgress) return;
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setIsOverlayActive(false);
		} else if (
			buttonFunction === OVERLAY_FUNCTIONS.DELETE_ACCOUNT &&
			!deletion
		) {
			const account = captureMatrixAccountForDeletion();
			setIsRequestInProgress(true);
			try {
				await apiDeleteAskerAccount(password);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === FETCH_ERRORS.BAD_REQUEST
				) {
					setIsPasswordWarningActive(true);
				}
				setIsRequestInProgress(false);
				return;
			}
			setPassword('');
			await finishLocalCleanup(account);
		} else if (buttonFunction === RETRY_LOCAL_CLEANUP && deletion) {
			setIsRequestInProgress(true);
			await finishLocalCleanup(deletion.account);
		} else if (buttonFunction === OVERLAY_FUNCTIONS.REDIRECT && deletion) {
			if (isDeletedAccountSessionCurrent(deletion.account))
				removeAllCookies();
			window.location.href = settings.urls.home;
		}
	};

	return (
		<>
			<div
				className="deleteAccount"
				data-tour-target="settings-delete-account"
			>
				<Button
					item={deleteAccountButton}
					buttonHandle={() => setIsOverlayActive(true)}
				/>
			</div>
			{isOverlayActive && (
				<Overlay
					className="deleteAccount__overlay"
					item={deletion ? overlaySuccess : overlayConfirm}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</>
	);
};
