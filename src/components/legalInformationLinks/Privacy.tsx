import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../../';
import useDocumentTitle from '../../utils/useDocumentTitle';
import { LegalPageWrapper } from '../legalPageWrapper/LegalPageWrapper';

export const Privacy = () => {
	const [t] = useTranslation();
	const tenant = useTenant();
	useDocumentTitle(t('profile.footer.dataprotection'));
	return (
		<LegalPageWrapper
			// Raw language map (new TenantService field) preferred: enables
			// client-side language resolution incl. machine-translation and
			// original-language notices. Falls back to the server-resolved
			// string on older backends; a missing/empty text shows the
			// placeholder warning instead of silently rendering nothing.
			content={tenant?.content?.privacy}
			rawContent={tenant?.content?.privacyLanguages}
			loading={!tenant}
			className={'terms'}
		/>
	);
};
