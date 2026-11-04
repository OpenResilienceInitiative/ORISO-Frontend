import * as React from 'react';
import { useContext, useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../legalLinks/LegalLinks';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';

const PLATFORM_SENTENCE =
	'Ich habe die {{legal_links}} zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Webseite Cookies. Damit erkläre ich mich einverstanden.';
const MISSING_POLICY_SENTENCE =
	'Für diese Beratungsstelle ist derzeit keine eigene Datenschutzerklärung hinterlegt. Wenn Sie fortfahren, nutzen Sie das Angebot auf eigenes Risiko. Mit dem Aktivieren des Kontrollkästchens stimmen Sie den {{legal_links}} dieser Website zu. Diese Website verwendet Cookies.';

/**
 * The fixed sentences a waiting room's consent falls back to, with the legal
 * links filled in: the platform sentence and the "no policy here" warning.
 * Inputs for `resolveEntryRoomConsent`, which picks between them and a
 * department's own wording.
 */
export const useConsentSentences = (agencyId?: number | null) => {
	const { t } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);

	const legalLinksHtml = useMemo(
		() =>
			renderToString(
				<LegalLinks
					legalLinks={legalLinks}
					filter={(link) => link.registration}
					params={{ aid: agencyId ?? null }}
					delimiter={', '}
				/>
			),
		[legalLinks, agencyId]
	);

	return {
		legalLinksHtml,
		platformHtml: t('anonymousConsent.label.text', {
			defaultValue: PLATFORM_SENTENCE,
			interpolation: { escapeValue: false },
			legal_links: legalLinksHtml
		}),
		missingPolicyHtml: t('anonymousConsent.label.missingPolicy', {
			defaultValue: MISSING_POLICY_SENTENCE,
			interpolation: { escapeValue: false },
			legal_links: legalLinksHtml
		})
	};
};
