import * as React from 'react';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import Switch from 'react-switch';
import { apiDeleteTwoFactorAuth } from '../../api';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { PenIcon } from '../../resources/img/icons';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
	STORAGE_KEY_DISABLE_2FA_DUTY,
	useDevToolbar
} from '../devToolbar/DevToolbar';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';
import { TWO_FACTOR_TYPES } from './twoFactorAuthConstants';
import './twoFactorAuth.styles';

export { OTP_LENGTH, TWO_FACTOR_TYPES } from './twoFactorAuthConstants';

export const TwoFactorAuth = () => {
	const { t: translate } = useTranslation();
	const location = useLocation();
	// v7 dropped the useLocation<T>() generic; cast the nav state back to a
	// known shape so these reads stay type-checked.
	const locationState = (location.state ?? {}) as {
		isEditMode?: boolean;
		openTwoFactor?: boolean;
	};
	const { userData, reloadUserData } = useContext(UserDataContext);
	const settings = useAppConfig();
	const { getDevToolbarOption } = useDevToolbar();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(
		locationState.isEditMode ?? false
	);
	const [isSwitchChecked, setIsSwitchChecked] = useState<boolean>(
		userData.twoFactorAuth.isActive
	);

	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const isTwoFactorBinding =
		new Date() >= settings.twofactor.dateTwoFactorObligatory;
	const isForcedSetup = isTwoFactorBinding && !isEditMode && isConsultant;
	const canDisable =
		(!isConsultant ||
			(process.env.NODE_ENV !== 'production' &&
				getDevToolbarOption(STORAGE_KEY_DISABLE_2FA_DUTY) === '1')) &&
		userData.twoFactorAuth.isActive;

	useEffect(() => {
		if (locationState.openTwoFactor) {
			setIsDialogOpen(true);
		}
	}, [locationState.openTwoFactor]);

	useEffect(() => {
		setIsSwitchChecked(userData.twoFactorAuth.isActive);
	}, [userData.twoFactorAuth.isActive]);

	const closeDialog = useCallback(() => {
		setIsDialogOpen(false);
		setIsEditMode(false);
		setIsSwitchChecked(userData.twoFactorAuth.isActive);
	}, [userData.twoFactorAuth.isActive]);

	const completeSetup = useCallback(async () => {
		await reloadUserData();
		setIsSwitchChecked(true);
	}, [reloadUserData]);

	const abortSetup = useCallback(() => {
		setIsSwitchChecked(userData.twoFactorAuth.isActive);
	}, [userData.twoFactorAuth.isActive]);

	const disableTwoFactorAuth = useCallback(async () => {
		await apiDeleteTwoFactorAuth();
		await reloadUserData();
		setIsSwitchChecked(false);
		setIsDialogOpen(false);
		setIsEditMode(false);
	}, [reloadUserData]);

	const handleSwitchChange = () => {
		if (!isSwitchChecked) {
			setIsSwitchChecked(true);
			setIsDialogOpen(true);
			return;
		}

		setIsSwitchChecked(false);
		apiDeleteTwoFactorAuth()
			.then(reloadUserData)
			.catch(() => setIsSwitchChecked(true));
	};

	const handleEditButton = () => {
		setIsDialogOpen(true);
		setIsEditMode(true);
	};

	return (
		<div className="twoFactorAuth">
			<div className="profile__content__title">
				<div className="twoFactorAuth__head">
					<Headline
						text={translate('twoFactorAuth.title')}
						semanticLevel="5"
					/>
					{isTwoFactorBinding && (
						<Button
							className="twoFactorAuth__edit__button"
							buttonHandle={handleEditButton}
							item={{
								type: BUTTON_TYPES.LINK_INLINE
							}}
							customIcon={
								<PenIcon
									aria-label={translate('twoFactorAuth.edit')}
									title={translate('twoFactorAuth.edit')}
								/>
							}
						/>
					)}
				</div>
				<Text
					className="tertiary"
					text={translate('twoFactorAuth.subtitle')}
					type="standard"
				/>
			</div>
			{!isTwoFactorBinding && (
				<label className="twoFactorAuth__switch">
					<Switch
						onChange={handleSwitchChange}
						checked={isSwitchChecked}
						uncheckedIcon={false}
						checkedIcon={false}
						width={48}
						height={26}
						onColor="#0A882F"
						offColor="#8C878C"
						boxShadow="0px 1px 4px rgba(0, 0, 0, 0.6)"
						handleDiameter={27}
						activeBoxShadow="none"
					/>
					<Text
						text={
							isSwitchChecked
								? translate('twoFactorAuth.switch.active.label')
								: translate(
										'twoFactorAuth.switch.deactive.label'
									)
						}
						type="standard"
					/>
				</label>
			)}
			{(isSwitchChecked || isTwoFactorBinding) &&
				userData.twoFactorAuth.type && (
					<p>
						<strong>
							{translate('twoFactorAuth.switch.type.label')}
						</strong>{' '}
						{translate(
							`twoFactorAuth.switch.type.${userData.twoFactorAuth.type}`
						)}{' '}
						{userData.twoFactorAuth.type === TWO_FACTOR_TYPES.EMAIL
							? `(${userData.email})`
							: ''}
					</p>
				)}
			<TwoFactorSetupDialog
				canClose={!isForcedSetup}
				canDisable={canDisable}
				currentType={userData.twoFactorAuth.type}
				email={userData.email}
				onClose={closeDialog}
				onDisable={disableTwoFactorAuth}
				onSetupAborted={abortSetup}
				onSetupComplete={completeSetup}
				open={isDialogOpen}
				qrCode={userData.twoFactorAuth.qrCode}
				secret={userData.twoFactorAuth.secret}
			/>
		</div>
	);
};
