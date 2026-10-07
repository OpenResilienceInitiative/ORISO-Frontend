import * as React from 'react';
import { useContext, useId } from 'react';
import { useTranslation } from 'react-i18next';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import { PasswordReset } from '../passwordReset/PasswordReset';
import { TwoFactorAuth } from '../twoFactorAuth/TwoFactorAuth';
import {
	EncryptionSettingsPanel,
	EncryptionSettingsPanelProps
} from './EncryptionSettings';
import { DisplayNameSettings } from './DisplayNameSettings';
import { DeleteAccount } from './DeleteAccount';
import { ProfileCard } from './ProfileCard';
import './securityPrivacySettings.styles';

export interface SecurityPrivacySettingsProps {
	/** Pass through the panel's existing deterministic story fixtures. */
	encryptionSettingsProps?: EncryptionSettingsPanelProps;
}

/** Group existing settings without changing their actions or role availability. */
export const SecurityPrivacySettings = ({
	encryptionSettingsProps
}: SecurityPrivacySettingsProps = {}) => {
	const { t } = useTranslation();
	const { userData } = useContext(UserDataContext);
	const id = useId();
	const consultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const asker = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	return (
		<div className="securityPrivacySettings">
			<section aria-labelledby={`${id}-account`}>
				<h2 id={`${id}-account`} className="headline headline--4">
					{t('profile.securityPrivacy.account.title')}
				</h2>
				<p className="securityPrivacySettings__description">
					{t('profile.securityPrivacy.account.description')}
				</p>
				<div className="profile__cards securityPrivacySettings__cards">
					<ProfileCard icon={LockOutlinedIcon}>
						<PasswordReset />
					</ProfileCard>
					{userData.twoFactorAuth?.isEnabled && (
						<ProfileCard icon={ShieldOutlinedIcon}>
							<TwoFactorAuth />
						</ProfileCard>
					)}
				</div>
			</section>
			<section aria-labelledby={`${id}-recovery`}>
				<h2 id={`${id}-recovery`} className="headline headline--4">
					{t('profile.securityPrivacy.recovery.title')}
				</h2>
				<p className="securityPrivacySettings__description">
					{t('profile.securityPrivacy.recovery.description')}
				</p>
				<div className="profile__cards securityPrivacySettings__cards">
					<ProfileCard icon={KeyOutlinedIcon}>
						<EncryptionSettingsPanel
							{...encryptionSettingsProps}
							showHeading={false}
						/>
					</ProfileCard>
				</div>
			</section>
			<section aria-labelledby={`${id}-privacy`}>
				<h2 id={`${id}-privacy`} className="headline headline--4">
					{t('profile.securityPrivacy.privacy.title')}
				</h2>
				<p className="securityPrivacySettings__description">
					{t('profile.securityPrivacy.privacy.description')}
				</p>
				<div className="profile__cards securityPrivacySettings__cards">
					{consultant && (
						<ProfileCard icon={PersonOutlineIcon}>
							<DisplayNameSettings />
						</ProfileCard>
					)}
					{asker && (
						<ProfileCard icon={DeleteOutlineIcon}>
							<DeleteAccount />
						</ProfileCard>
					)}
				</div>
			</section>
		</div>
	);
};
