import * as React from 'react';
import './encryptionBanner.styles.scss';
import { ReactComponent as LockIcon } from '../../resources/img/icons/lock.svg';
import { useTranslation } from 'react-i18next';

export const EncryptionBanner = () => {
	const { t: translate } = useTranslation();

	// Always show encryption as enabled
	return (
		<div className="encryption-banner encryption-banner--enabled">
			<div className="encryption-banner__icon">
				<LockIcon />
			</div>
			<div className="encryption-banner__content">
				<div className="encryption-banner__heading">
					End-to-end encryption is enabled
				</div>
				<div className="encryption-banner__description">
					{translate('e2ee.hint', 'Messages in this room are end-to-end encrypted. Your messages are secured with locks. Only you and the recipient have the unique keys to unlock them.')}
				</div>
			</div>
		</div>
	);
};

