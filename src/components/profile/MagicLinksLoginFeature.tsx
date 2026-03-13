import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../hooks/useAppConfig';
import { Button, BUTTON_TYPES } from '../button/Button';
import { Headline } from '../headline/Headline';
import { Text } from '../text/Text';

export const MagicLinksLoginFeature = () => {
	const { t: translate } = useTranslation();
	const settings = useAppConfig();
	const initialEnabled = Boolean(
		(settings?.releaseToggles as Record<string, boolean> | undefined)
			?.enableMagicLinksLogin
	);
	const [isEnabled, setIsEnabled] = useState(initialEnabled);

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

			<div className="button__wrapper">
				<Button
					item={{
						label: isEnabled
							? 'profile.functions.magicLinks.button.enabled'
							: 'profile.functions.magicLinks.button.enable',
						type: BUTTON_TYPES.LINK
					}}
					buttonHandle={() => setIsEnabled(true)}
					disabled={isEnabled}
				/>
			</div>
		</div>
	);
};


