import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';
import { Switch } from '../Switch';
import { UserDataContext } from '../../globalState';
import { apiPatchUserData } from '../../api/apiPatchUserData';

export const MagicLinksLoginFeature = () => {
	const { t: translate } = useTranslation();
	const settings = useAppConfig();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const hasEmail = !!userData?.email;

	const releaseToggleDefault = Boolean(
		(settings?.releaseToggles as Record<string, boolean> | undefined)
			?.enableMagicLinksLogin
	);
	const [isEnabled, setIsEnabled] = useState<boolean>(false);
	const [isSaving, setIsSaving] = useState<boolean>(false);

	useEffect(() => {
		const nextState =
			typeof userData?.magicLinkLoginEnabled === 'boolean'
				? userData.magicLinkLoginEnabled
				: releaseToggleDefault;
		setIsEnabled(hasEmail ? nextState : false);
	}, [hasEmail, releaseToggleDefault, userData?.magicLinkLoginEnabled]);

	const handleToggle = async (enabled: boolean) => {
		if (!hasEmail) {
			return;
		}
		if (isSaving) {
			return;
		}
		setIsSaving(true);
		const previous = isEnabled;
		setIsEnabled(enabled);
		try {
			await apiPatchUserData({ magicLinkLoginEnabled: enabled });
			await reloadUserData();
		} catch {
			setIsEnabled(previous);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="notifications__content">
			<div className="profile__content__title">
				<Headline
					text={translate('profile.functions.magicLinks.title')}
					semanticLevel="5"
				/>
				<Text
					text={translate('profile.functions.magicLinks.subtitle')}
					type="standard"
					className="tertiary"
				/>
			</div>
			{!hasEmail && (
				<Text
					text={translate(
						'profile.functions.magicLinks.emailRequired'
					)}
					type="infoSmall"
					className="tertiary"
				/>
			)}

			<div className="flex">
				<Switch
					className="mr--1"
					onChange={handleToggle}
					checked={isEnabled}
					disabled={!hasEmail || isSaving}
					aria-label={
						isEnabled
							? translate(
									'profile.functions.magicLinks.toggle.enabled'
								)
							: translate(
									'profile.functions.magicLinks.toggle.disabled'
								)
					}
				/>
				<Text
					text={
						isEnabled
							? translate(
									'profile.functions.magicLinks.toggle.enabled'
								)
							: translate(
									'profile.functions.magicLinks.toggle.disabled'
								)
					}
					type="standard"
				/>
			</div>
		</div>
	);
};
