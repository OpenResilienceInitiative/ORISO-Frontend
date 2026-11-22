import * as React from 'react';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
	apiDeleteTwoFactorAuth,
	apiPutEmail,
	FETCH_ERRORS,
	X_REASON
} from '../../api';
import { UserDataContext } from '../../globalState';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { EditableData } from '../editableData/EditableData';
import { Text } from '../text/Text';
import { OverlayItem, OVERLAY_FUNCTIONS } from '../overlay/Overlay';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { ReactComponent as CheckIllustration } from '../../resources/img/illustrations/check.svg';
import { ReactComponent as XIllustration } from '../../resources/img/illustrations/x.svg';
import { apiDeleteEmail } from '../../api/apiDeleteEmail';
import { TWO_FACTOR_TYPES } from '../twoFactorAuth/twoFactorAuthConstants';
import { Headline } from '../headline/Headline';
import { useTranslation } from 'react-i18next';
import { ProfileAvatarChoice } from './ProfileAvatarChoice';
import { useAccountEmailCollectionAllowed } from '../../hooks/useAccountEmailCollectionAllowed';

import { useResponsive } from '../../hooks/useResponsive';
import './askerAboutMeData.styles.scss';

export const AskerAboutMeData = () => {
	const { t: translate } = useTranslation();
	const { untilM } = useResponsive();

	const { userData, reloadUserData } = useContext(UserDataContext);
	/* UserService#1662: a temporary account has no e-mail address until it
	   is kept; the server refuses to save one. */
	const temporary = Boolean(userData.temporaryAccount);
	const emailAllowed = useAccountEmailCollectionAllowed() && !temporary;

	const [isEmailDisabled, setIsEmailDisabled] = useState<boolean>(true);
	const [overlay, setOverlay] = useState<OverlayItem>(null);
	const [email, setEmail] = useState<string>();
	const [emailLabel, setEmailLabel] = useState<string>(
		translate('profile.data.email')
	);
	const [isRequestInProgress, setIsRequestInProgress] =
		useState<boolean>(false);
	const [isEmailNotAvailable, setIsEmailNotAvailable] =
		useState<boolean>(false);

	const cancelEditButton: ButtonItem = {
		label: translate('profile.data.edit.button.cancel'),
		type: BUTTON_TYPES.LINK
	};

	const isEmail2faActive =
		userData.twoFactorAuth?.isActive &&
		userData.twoFactorAuth?.type === TWO_FACTOR_TYPES.EMAIL;

	const overlay2faEmailEdit: OverlayItem = useMemo(
		() => ({
			headline: translate(
				'twoFactorAuth.email.change.confirmOverlay.title'
			),
			nestedComponent: (
				<>
					<p>
						{translate(
							'twoFactorAuth.email.change.confirmOverlay.copy.1'
						)}
					</p>
					<p>
						{translate(
							'twoFactorAuth.email.change.confirmOverlay.copy.2'
						)}
					</p>
				</>
			),
			buttonSet: [
				{
					label: translate(
						'twoFactorAuth.email.change.confirmOverlay.button.deny'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY
				},
				{
					label: translate(
						'twoFactorAuth.email.change.confirmOverlay.button.confirm'
					),
					function: OVERLAY_FUNCTIONS.CONFIRM_EDIT,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[translate]
	);

	const overlaySuccess: OverlayItem = useMemo(
		() => ({
			headline: translate('profile.unsetEmail.successOverlay.headline'),
			svg: CheckIllustration,
			buttonSet: [
				{
					label: translate(
						'profile.unsetEmail.successOverlay.button'
					),
					function: OVERLAY_FUNCTIONS.CLOSE_SUCCESS,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[translate]
	);

	const overlayConfirm: OverlayItem = useMemo(
		() => ({
			headline: translate('profile.unsetEmail.confirmOverlay.headline'),
			copy: translate('profile.unsetEmail.confirmOverlay.copy'),
			nestedComponent: (
				<ul className="">
					<li>
						{translate(
							'profile.unsetEmail.confirmOverlay.benefit.1'
						)}
					</li>
					<li>
						{translate(
							'profile.unsetEmail.confirmOverlay.benefit.2'
						)}
					</li>
					{isEmail2faActive && (
						<li>
							{translate(
								'twoFactorAuth.email.delete.confirmOverlay.copy'
							)}
						</li>
					)}
				</ul>
			),
			buttonSet: [
				{
					label: translate(
						'profile.unsetEmail.confirmOverlay.button.deny'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.SECONDARY
				},
				{
					label: translate(
						'profile.unsetEmail.confirmOverlay.button.confirm'
					),
					function: OVERLAY_FUNCTIONS.DELETE_EMAIL,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[isEmail2faActive, translate]
	);

	const overlayError: OverlayItem = useMemo(
		() => ({
			headline: translate('profile.unsetEmail.errorOverlay.headline'),
			svg: XIllustration,
			buttonSet: [
				{
					label: translate('profile.unsetEmail.errorOverlay.button'),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[translate]
	);

	const handleCancelEditButton = () => {
		setIsEmailDisabled(true);
		setEmailLabel(translate('profile.data.email'));
	};

	const saveEditButton: ButtonItem = {
		disabled: !email,
		label: translate('profile.data.edit.button.save'),
		type: BUTTON_TYPES.LINK
	};

	const handleSaveEditButton = () => {
		if (!emailAllowed) return;
		if (isEmail2faActive) {
			setOverlay(overlay2faEmailEdit);
		} else if (!isRequestInProgress) {
			setIsRequestInProgress(true);
			apiPutEmail(email)
				.then(reloadUserData)
				.then(() => {
					setIsEmailDisabled(true);
					setEmailLabel(translate('profile.data.email'));
				})
				.catch((error: Response) => {
					const reason = error.headers?.get(FETCH_ERRORS.X_REASON);
					if (reason === X_REASON.EMAIL_NOT_AVAILABLE) {
						setIsEmailNotAvailable(true);
					}
				})
				.finally(() => setIsRequestInProgress(false));
		}
	};

	const handleEmailChange = (email) => {
		setEmailLabel(translate('profile.data.email'));
		setEmail(email);
		setIsEmailNotAvailable(false);
	};

	const handleSingleClear = () => {
		setOverlay(overlayConfirm);
	};

	const deletionInFlight = useRef(false);
	const handleDeleteEmail = useCallback(async () => {
		if (deletionInFlight.current) return;
		deletionInFlight.current = true;
		setIsRequestInProgress(true);
		try {
			// Removing an email must not leave an active factor pointing at it.
			if (isEmail2faActive) await apiDeleteTwoFactorAuth();
			await apiDeleteEmail();
			setEmail(null);
			setOverlay(overlaySuccess);
			await Promise.resolve(reloadUserData()).catch(() => undefined);
		} catch {
			setOverlay(overlayError);
		} finally {
			deletionInFlight.current = false;
			setIsRequestInProgress(false);
		}
	}, [isEmail2faActive, overlaySuccess, overlayError, reloadUserData]);

	const handleOverlayAction = (buttonFunction: string) => {
		switch (buttonFunction) {
			case OVERLAY_FUNCTIONS.CONFIRM_EDIT:
				if (!emailAllowed) {
					setOverlay(null);
					return;
				}
				const handleConfirm = () => {
					setIsEmailDisabled(false);
					setOverlay(null);
				};
				if (isEmail2faActive) {
					apiDeleteTwoFactorAuth().then(() => {
						handleConfirm();
						reloadUserData().catch((error) => {
							/* console.log(error); */
						});
					});
				} else {
					handleConfirm();
				}
				break;
			case OVERLAY_FUNCTIONS.CLOSE:
			case OVERLAY_FUNCTIONS.CLOSE_SUCCESS:
				setOverlay(null);
				break;
			case OVERLAY_FUNCTIONS.DELETE_EMAIL:
				void handleDeleteEmail();
				break;
		}
	};

	return (
		<div>
			<div className="profile__content__title">
				<Headline
					className="pr--3 askerAboutMeData__heading"
					text={translate('profile.data.title.asker')}
					semanticLevel="5"
				/>
				{emailAllowed && (
					<Text
						text={translate('profile.data.emailInfo')}
						type="standard"
						className="tertiary"
					/>
				)}
			</div>
			<ProfileAvatarChoice />
			<EditableData
				label={translate('profile.data.userName')}
				initialValue={userData.userName}
				type="text"
				isDisabled
			/>
			{!temporary && (emailAllowed || userData.email) && (
				<EditableData
					label={emailLabel}
					type="email"
					initialValue={userData.email}
					isDisabled={!emailAllowed || isEmailDisabled}
					isSingleEdit={emailAllowed}
					onSingleEditActive={() => {
						if (!emailAllowed) return;
						if (isEmail2faActive) {
							setOverlay(overlay2faEmailEdit);
						} else {
							setIsEmailDisabled(false);
						}
					}}
					isSingleClearable={true}
					onSingleClear={handleSingleClear}
					onValueIsValid={handleEmailChange}
					isEmailAlreadyInUse={isEmailNotAvailable}
				/>
			)}
			{!temporary && !emailAllowed && userData.email && (
				<Button
					item={{
						label: translate(
							'profile.unsetEmail.confirmOverlay.button.confirm'
						),
						type: BUTTON_TYPES.LINK,
						disabled: isRequestInProgress
					}}
					buttonHandle={handleSingleClear}
				/>
			)}
			{emailAllowed && !isEmailDisabled && (
				<div className="editableData__buttonSet editableData__buttonSet--edit">
					<Button
						item={cancelEditButton}
						buttonHandle={handleCancelEditButton}
					/>
					<Button
						item={saveEditButton}
						buttonHandle={handleSaveEditButton}
					/>
				</div>
			)}
			{overlay &&
				(emailAllowed ||
					!overlay.buttonSet?.some(
						(button) =>
							button.function === OVERLAY_FUNCTIONS.CONFIRM_EDIT
					)) && (
					<M3Dialog
						data-testid="profile-email-dialog"
						title={overlay.headline}
						description={overlay.copy}
						icon={
							overlay.svg
								? React.createElement(overlay.svg)
								: undefined
						}
						closable={false}
						fullScreen={untilM}
						onClose={() => setOverlay(null)}
						actions={overlay.buttonSet?.map((button) => ({
							label: button.label,
							onClick: () => handleOverlayAction(button.function),
							primary: button.type === BUTTON_TYPES.PRIMARY
						}))}
					>
						{overlay.nestedComponent}
					</M3Dialog>
				)}
		</div>
	);
};
