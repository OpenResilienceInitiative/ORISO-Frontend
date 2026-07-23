import * as React from 'react';
import { useCallback, useContext, useState, useEffect } from 'react';
import { ReactComponent as CopyIcon } from '../../resources/img/icons/documents.svg';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';
import {
	AUTHORITIES,
	hasUserAuthority,
	NotificationsContext,
	UserDataContext,
	NOTIFICATION_TYPE_SUCCESS,
	NOTIFICATION_TYPE_ERROR
} from '../../globalState';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { copyTextToClipboard } from '../../utils/clipboardHelpers';
import { Tooltip } from '../tooltip/Tooltip';
import { GenerateQrCode } from '../generateQrCode/GenerateQrCode';
import { PenIcon } from '../../resources/img/icons';
import { Button, ButtonItem, BUTTON_TYPES } from '../button/Button';
import { EditableData } from '../editableData/EditableData';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { apiPutConsultantData } from '../../api/apiPutConsultantData';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';

const PUBLIC_SLUG_PATTERN = /^[a-z]+(-[a-z]+)*$/;

export const ConsultantInformation = () => {
	const { t: translate } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { addNotification } = useContext(NotificationsContext);
	const [isEditEnabled, setIsEditEnabled] = useState(false);
	const [editedDisplayName, setEditedDisplayName] = useState('');
	const [initialDisplayName, setInitialDisplayName] = useState('');
	const [isSlugEditEnabled, setIsSlugEditEnabled] = useState(false);
	const [editedPublicSlug, setEditedPublicSlug] = useState('');
	const [isSlugSaveDisabled, setIsSlugSaveDisabled] = useState(true);
	const [isSlugRequestInProgress, setIsSlugRequestInProgress] =
		useState(false);

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

	const handleValidPublicSlug = useCallback((publicSlug) => {
		setEditedPublicSlug(publicSlug?.toLowerCase() ?? '');
	}, []);

	const handleCancelSlugEditButton = () => {
		setEditedPublicSlug(
			userData.pendingPublicSlug || userData.publicSlug || ''
		);
		setIsSlugEditEnabled(false);
	};

	const handleSaveSlugEditButton = () => {
		if (isSlugRequestInProgress) {
			return;
		}

		const normalizedPublicSlug = editedPublicSlug.trim().toLowerCase();
		setIsSlugRequestInProgress(true);

		apiPutConsultantData({
			email: userData.email?.trim(),
			firstname: userData.firstName?.trim(),
			lastname: userData.lastName?.trim(),
			// The generated DTO narrows languages to the LanguageCode union.
			languages: (userData.languages ||
				[]) as UserService.Schemas.LanguageCode[],
			publicSlug: normalizedPublicSlug
		})
			.then(reloadUserData)
			.then(() => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_SUCCESS,
					title: translate(
						'profile.data.publicSlug.notification.title'
					),
					text: translate('profile.data.publicSlug.notification.text')
				});
				setIsSlugEditEnabled(false);
			})
			.catch(() => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_ERROR,
					title: translate('profile.notifications.error.title'),
					text: translate(
						'profile.data.publicSlug.notification.error'
					),
					closeable: true,
					timeout: 60000
				});
			})
			.finally(() => {
				setIsSlugRequestInProgress(false);
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

	useEffect(() => {
		// While the slug is being edited, background userData refreshes must
		// not overwrite the user's unsaved typing.
		if (isSlugEditEnabled) {
			return;
		}

		setEditedPublicSlug(
			userData.pendingPublicSlug || userData.publicSlug || ''
		);
	}, [isSlugEditEnabled, userData.pendingPublicSlug, userData.publicSlug]);

	useEffect(() => {
		const normalizedPublicSlug = editedPublicSlug.trim().toLowerCase();
		const currentSlug =
			userData.pendingPublicSlug || userData.publicSlug || '';
		setIsSlugSaveDisabled(
			isSlugRequestInProgress ||
				normalizedPublicSlug === currentSlug ||
				!PUBLIC_SLUG_PATTERN.test(normalizedPublicSlug)
		);
	}, [
		editedPublicSlug,
		isSlugRequestInProgress,
		userData.pendingPublicSlug,
		userData.publicSlug
	]);

	const isDisplayNameFeatureEnabled = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	)
		? true
		: userData?.isDisplayNameEditable;

	const publicSlugStatusText =
		userData.publicSlugStatus === 'PENDING' && userData.pendingPublicSlug
			? translate('profile.data.publicSlug.status.pending', {
					slug: userData.pendingPublicSlug
				})
			: userData.publicSlugStatus === 'REJECTED'
				? translate('profile.data.publicSlug.status.rejected')
				: userData.publicSlug
					? translate('profile.data.publicSlug.status.active', {
							slug: userData.publicSlug
						})
					: translate('profile.data.publicSlug.status.empty');

	return (
		<div>
			<div className="profile__content__title">
				<div className="flex flex--fd-row flex--jc-sb">
					<Headline
						className="pr--3"
						text={translate('profile.data.title.information')}
						semanticLevel="5"
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
				{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && (
					<PersonalRegistrationLink
						consultantIdentifier={
							userData.publicSlug || userData.userId
						}
						className="profile__user__personal_link mb--1"
					/>
				)}
			</div>
			<div>
				<Text
					text={translate('profile.data.info.public')}
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
			{hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) && (
				<div className="mt--2">
					<div className="flex flex--fd-row flex--jc-sb">
						<Headline
							className="pr--3"
							text={translate('profile.data.publicSlug.label')}
							semanticLevel="5"
						/>
						{!isSlugEditEnabled && (
							<button
								type="button"
								className="button-as-link tertiary"
								onClick={() => {
									setIsSlugEditEnabled(true);
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
						text={translate('profile.data.publicSlug.info')}
						type="standard"
						className="tertiary"
					/>
					<EditableData
						label={translate('profile.data.publicSlug.input')}
						type="text"
						initialValue={
							userData.pendingPublicSlug ||
							userData.publicSlug ||
							''
						}
						isDisabled={!isSlugEditEnabled}
						onValueIsValid={handleValidPublicSlug}
					/>
					<Text
						text={publicSlugStatusText}
						type="standard"
						className="tertiary"
					/>
					{isSlugEditEnabled && (
						<div className="editableData__buttonSet editableData__buttonSet--edit">
							<Button
								item={cancelEditButton}
								buttonHandle={handleCancelSlugEditButton}
							/>
							<Button
								item={{
									...saveEditButton,
									disabled: isSlugSaveDisabled
								}}
								buttonHandle={handleSaveSlugEditButton}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

type PersonalRegistrationLinkProps = {
	consultantIdentifier: string;
	className: string;
};

const PersonalRegistrationLink = ({
	consultantIdentifier,
	className
}: PersonalRegistrationLinkProps) => {
	const { t: translate } = useTranslation();
	const settings = useAppConfig();

	const { addNotification } = useContext(NotificationsContext);

	const copyRegistrationLink = useCallback(async () => {
		await copyTextToClipboard(
			`${settings.urls.registration}?cid=${consultantIdentifier}`,
			() => {
				addNotification({
					notificationType: NOTIFICATION_TYPE_SUCCESS,
					title: translate(
						'profile.data.personal.registrationLink.notification.title'
					),
					text: translate(
						'profile.data.personal.registrationLink.notification.text'
					)
				});
			}
		);
	}, [
		settings.urls.registration,
		consultantIdentifier,
		addNotification,
		translate
	]);

	return (
		<div
			className={`flex flex--wrap flex--ai-c flex-xl--nowrap ${className}`}
		>
			<div className="mt--1">
				<GenerateQrCode
					url={`${settings.urls.registration}?cid=${consultantIdentifier}`}
					filename={'kontaktlink'}
					headline={translate(`qrCode.personal.overlay.headline`)}
					text={translate(`qrCode.personal.overlay.info`)}
				/>
			</div>
			<div className="flex flex--ai-c flex--nowrap mt--1">
				<button
					type="button"
					className="text--right text--nowrap mr--1 text--tertiary primary button-as-link"
					tabIndex={0}
					onClick={copyRegistrationLink}
					title={translate(
						'profile.data.personal.registrationLink.title'
					)}
					aria-label={translate(
						'profile.data.personal.registrationLink.title'
					)}
				>
					<CopyIcon className={`copy icn--s`} />{' '}
					{translate('profile.data.personal.registrationLink.text')}
				</button>
				<div className="flex-xl__col--no-grow flex--inline flex--ai-c">
					<div className="flex-xl__col--no-grow flex--inline flex--ai-c">
						<Tooltip
							trigger={
								<InfoIcon
									className="icn icn--xl"
									title={translate('notifications.info')}
									aria-label={translate('notifications.info')}
								/>
							}
						>
							{translate(
								'profile.data.personal.registrationLink.tooltip'
							)}
						</Tooltip>
					</div>
				</div>
			</div>
		</div>
	);
};
