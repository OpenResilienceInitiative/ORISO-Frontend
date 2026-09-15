import * as React from 'react';
import { FC, useContext, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { getLegalLinkKind } from '../../legalLinks/useLegalLinkContent';
import { LegalLinkButton } from '../../legalLinks/LegalLinkButton';
import { M3Snackbar, m3SnackbarColors } from '../../m3Snackbar/M3Snackbar';
import { translateWithFallback } from '../../../utils/translationFallback';

/**
 * The privacy note at the live-chat account step.
 *
 * **Why it is a note and not a checkbox.** In the live chat the real consent
 * happens later, in the waiting room, on the agency that actually accepted the
 * conversation (ORISO-Frontend#1341, items 2 and 5). Asking for it twice — once
 * against nobody, once against the Beratungsstelle — would collect an
 * agreement that binds to no one. So this step only *says* what applies, and
 * says it in the snackbar the design system has for exactly that.
 *
 * **Wording.** Frank's, verbatim, down to „diese Websites":
 *
 * > Das ist unsere Datenschutzbestimmung. Für Authentifizierung und Navigation
 * > verwendet diese Websites Cookies.
 *
 * It ships as the German fallback of three catalogue keys, so it is there for a
 * fresh tenant and a platform admin who has configured nothing — the same route
 * `registration.dataProtection.cookieNotice` already takes for the other piece
 * of client-owned wording that no Träger may edit away (ADR-021 decision 2).
 * Nothing in the backend has to be seeded first.
 *
 * **The link** is the platform data-privacy document, opened in the very popup
 * the footer's „Datenschutzerklärung" opens — `LegalLinkButton` with its
 * default `scope="platform"`, the same call `StageLayout`'s footer makes. Only
 * the visible label differs, because Frank named the word in the sentence.
 */
export const DataProtectionSnackbar: FC<{
	/** Layout only, handed down by the step that places it. */
	sx?: SxProps<Theme>;
}> = ({ sx }) => {
	const { t } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);
	const [dismissed, setDismissed] = useState(false);

	/* The configured privacy entry, identified by its untranslated key — the
	   one stable signal, exactly as `useLegalLinkContent` documents. A
	   deployment that has no privacy link configured gets the sentence without
	   the anchor rather than a dead one. */
	const privacyLink = useMemo(
		() =>
			legalLinks.find(
				({ label }) => getLegalLinkKind('', '', label) === 'privacy'
			),
		[legalLinks]
	);

	const linkLabel = translateWithFallback(
		t,
		'registration.dataProtection.snackbar.link',
		'Datenschutzbestimmung'
	);

	const suffix = translateWithFallback(
		t,
		'registration.dataProtection.snackbar.suffix',
		'. Für Authentifizierung und Navigation verwendet diese Websites Cookies.'
	);
	/* A `<button>` is an atomic inline, so the browser is free to break the
	   line straight after it — which put the full stop of this sentence alone
	   at the start of the next line. Everything up to the first space stays
	   glued to the link instead. Languages whose suffix starts with a space
	   (Tigrinya) simply get an empty glue and break as they always would. */
	const glueEnd = suffix.search(/\s/);
	const glue = glueEnd === -1 ? suffix : suffix.slice(0, glueEnd);
	const rest = glueEnd === -1 ? '' : suffix.slice(glueEnd);

	return (
		<M3Snackbar
			placement="inline"
			/* Present from the first paint rather than announced — there is no
			   event here, only a standing statement. */
			role="status"
			testId="registration-dataprotection-snackbar"
			open={!dismissed}
			onClose={() => setDismissed(true)}
			closeLabel={translateWithFallback(t, 'app.close', 'Schließen')}
			sx={{
				/* The inline placement inherits the surrounding link colour,
				   which is the registration red — unreadable on the inverse
				   surface. The anchor takes the snackbar's own text role and
				   stays underlined, as in the design. */
				'& .legalLinkButton--inline': {
					color: m3SnackbarColors.onSurface,
					textDecoration: 'underline'
				},
				...sx
			}}
			message={
				<>
					{translateWithFallback(
						t,
						'registration.dataProtection.snackbar.prefix',
						'Das ist unsere '
					)}
					<Box component="span" sx={{ whiteSpace: 'nowrap' }}>
						{privacyLink ? (
							<LegalLinkButton
								variant="inline"
								label={linkLabel}
								rawLabel={privacyLink.label}
								url={privacyLink.getUrl({})}
							/>
						) : (
							/* `.legalLinkButton--inline` sets `white-space:
							   normal`, so the real link keeps wrapping inside
							   the glue span; the bare label needs to say so
							   itself. */
							<Box component="span" sx={{ whiteSpace: 'normal' }}>
								{linkLabel}
							</Box>
						)}
						{glue}
					</Box>
					{rest}
				</>
			}
		/>
	);
};
