import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	hasUserAuthority,
	NotificationsContext,
	UserDataContext,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { PenIcon } from '../../resources/img/icons';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { EditableData } from '../editableData/EditableData';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';

/** The existing consultant editor, moved from General into Privacy. */
export const DisplayNameSettings = () => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const [isEditEnabled, setIsEditEnabled] = useState(false);
	const [editedDisplayName, setEditedDisplayName] = useState('');
	const [initialDisplayName, setInitialDisplayName] = useState('');
	const cancelEditButton: ButtonItem = {
		label: translate('profile.data.edit.button.cancel'),
		type: BUTTON_TYPES.LINK
	};

	const saveEditButton: ButtonItem = {
		disabled: !editedDisplayName?.trim(),
		label: translate('profile.data.edit.button.save'),
		type: BUTTON_TYPES.LINK
	};

	const handleValidDisplayName = useCallback((displayName) => {
		setEditedDisplayName(displayName);
	}, []);

	const handleCancelEditButton = () => {
		const displayName = userData.displayName || userData.userName || '';
		setInitialDisplayName(displayName);
		setEditedDisplayName(displayName);
		setIsEditEnabled(false);
	};

	const handleSaveEditButton = () => {
		apiPatchUserData({ displayName: editedDisplayName })
			.then(() => {
				reloadUserData().catch((error) => {
					/* console.log(error); */
				});
				setInitialDisplayName(editedDisplayName);
			})
			.catch((error) => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('profile.notifications.error.title'),
					text: translate('profile.notifications.error.description'),
					closeable: true,
					timeout: 60000
				});
				// console.error('Error while patching consultant', error);
			})
			.finally(() => {
				setIsEditEnabled(false);
			});
	};

	useEffect(() => {
		if (isEditEnabled) {
			return;
		}

		const displayName = userData.displayName || userData.userName || '';
		setInitialDisplayName(displayName);
		setEditedDisplayName(displayName);
	}, [isEditEnabled, userData.displayName, userData.userName]);

	const isDisplayNameFeatureEnabled = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	)
		? true
		: userData?.isDisplayNameEditable;

	return (
		<div className="displayNameSettings">
			<div className="profile__content__title">
				<div className="flex flex--fd-row flex--jc-sb">
					<Headline
						text={translate('profile.data.displayName')}
						semanticLevel="3"
						styleLevel="5"
					/>
					{isDisplayNameFeatureEnabled && !isEditEnabled && (
						<button
							type="button"
							className="button-as-link tertiary"
							onClick={() => {
								setIsEditEnabled(true);
							}}
							aria-label={translate(
								'profile.data.edit.button.edit'
							)}
						>
							<PenIcon />
						</button>
					)}
				</div>
				<Text
					text={translate(
						'profile.securityPrivacy.displayNameDescription'
					)}
					type="standard"
					className="tertiary"
				/>
			</div>
			<EditableData
				label={translate('profile.data.displayName')}
				type="text"
				initialValue={initialDisplayName}
				isDisabled={!isDisplayNameFeatureEnabled || !isEditEnabled}
				onValueIsValid={handleValidDisplayName}
			/>
			{isDisplayNameFeatureEnabled && isEditEnabled && (
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
		</div>
	);
};
