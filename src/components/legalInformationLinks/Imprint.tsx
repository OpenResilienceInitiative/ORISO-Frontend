import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../../';
import useDocumentTitle from '../../utils/useDocumentTitle';
import { LegalPageWrapper } from '../legalPageWrapper/LegalPageWrapper';

export const Imprint = () => {
	const [t] = useTranslation();
	const tenant = useTenant();
	useDocumentTitle(t('profile.footer.imprint'));

	return (
		<LegalPageWrapper
			content={tenant?.content?.impressum || t('profile.footer.imprint')}
			className={'terms'}
		/>
	);
};
