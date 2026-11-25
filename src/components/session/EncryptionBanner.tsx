import * as React from 'react';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { useTranslation } from 'react-i18next';
import './encryptionBanner.styles.scss';

export const EncryptionBanner = () => {
	const { t } = useTranslation();

	return (
		<p className="session-encryption-status">
			<VpnKeyOutlinedIcon aria-hidden />
			<span>{t('e2ee.encryptedConversation')}</span>
		</p>
	);
};
