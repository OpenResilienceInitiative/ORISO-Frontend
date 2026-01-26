import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../..';
import useDocumentTitle from '../../utils/useDocumentTitle';
import { LegalPageWrapper } from '../legalPageWrapper/LegalPageWrapper';

export const TermsAndConditions = () => {
	const [t] = useTranslation();
	const tenant = useTenant();
	useDocumentTitle(t('legal.termsAndConditions.label'));
	return (
		<LegalPageWrapper
			content={
				tenant?.content?.termsAndConditions ||
				t('legal.termsAndConditions.label')
			}
			className="terms"
		/>
	);
};
