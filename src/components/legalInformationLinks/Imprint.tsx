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
			// Raw language map (new TenantService field) preferred: enables
			// client-side language resolution incl. machine-translation and
			// original-language notices. Falls back to the server-resolved
			// string on older backends; a missing/empty text shows the
			// placeholder warning instead of silently rendering nothing.
			content={tenant?.content?.impressum}
			rawContent={tenant?.content?.impressumLanguages}
			loading={!tenant}
			className={'terms'}
		/>
	);
};
