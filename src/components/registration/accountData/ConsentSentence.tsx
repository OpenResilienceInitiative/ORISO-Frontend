import * as React from 'react';
import { FC, useContext, useMemo } from 'react';
import { Typography } from '@mui/material';
import parse, { DOMNode, Element } from 'html-react-parser';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinkButton } from '../../legalLinks/LegalLinkButton';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { ConsentTextData } from '../../../api/apiGetConsentText';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
import { normalizeLegalLang } from '../../../utils/legalContent';
import { useTraegerSentenceHtml } from './useTraegerSentenceHtml';

/**
 * A language code as a reader of `uiLang` would name it, or the bare code.
 *
 * `Intl.DisplayNames` keeps this out of the catalogues: naming every authored
 * language in every UI language by hand would go stale the first time a Träger
 * writes in one nobody listed.
 */
const languageName = (code: string, uiLang?: string): string => {
	try {
		return (
			new Intl.DisplayNames([uiLang || 'de'], { type: 'language' }).of(
				code
			) ?? code
		);
	} catch {
		return code;
	}
};

export interface ConsentSentenceProps {
	/**
	 * The Träger-authored consent text of the selected Fachbereich, or `null`
	 * when none is configured — which is the normal case today and must render
	 * exactly the pre-#250 sentence.
	 */
	consentText: ConsentTextData | null;
	/** Selected agency — passed to the legal-link modal (`scope="agency"`). */
	agency?: AgencyDataInterface;
	/** Selected topic — passed to the legal-link modal (`scope="agency"`). */
	topic?: TopicsDataInterface;
}

/**
 * The consent sentence itself — everything the checkbox label shows, and
 * nothing about where the text came from. `DataProtectionConsentLabel` owns
 * the fetch; this component owns the rendering, which is what makes both the
 * fallback and the Träger shape reviewable in Storybook without a backend.
 *
 * **Fallback** (`consentText === null`): the three i18n fragments
 * (`registration.dataProtection.label.{prefix,and,suffix}`) assembled around
 * `<LegalLinks>`, byte-for-byte as before EPIC ORISO-AgencyService#250. The
 * cookie notice is part of the `suffix` there, so no addendum is added.
 *
 * **Träger sentence**: `{{Beratungsstelle}}` and `{{Thema}}` were substituted
 * server-side (ADR-021 decision 5); this substitutes `{{legal_links}}` with
 * the real anchors, sanitizes through the shared legal-HTML allowlist, and
 * renders the fixed, non-editable cookie/authentication notice beneath
 * (decision 2 — a Träger text *replaces* the platform sentence, so the
 * platform's mandatory disclosure has to survive that replacement on its own).
 */
export const ConsentSentence: FC<ConsentSentenceProps> = ({
	consentText,
	agency,
	topic
}) => {
	const { t, i18n } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);

	const traegerSentence = useTraegerSentenceHtml(consentText, {
		agencyName: agency?.name,
		topicName: topic?.name
	});

	/* Which raw i18n key belongs to a given anchor href — the modal needs this
	   to decide imprint vs privacy in a language-safe way. Match on href by
	   pushing every configured legal-link URL (with the same params the anchors
	   were rendered with) through `getUrl`. */
	const rawLabelForHref = useMemo(() => {
		const byUrl = new Map<string, string>();
		legalLinks.forEach((link) => {
			byUrl.set(link.getUrl({ aid: null }), link.label);
		});
		return (href: string | undefined) =>
			href ? byUrl.get(href) : undefined;
	}, [legalLinks]);

	/* Parse the Träger sentence HTML and swap the platform's legal anchors
	   (`{{legal_links}}` substitutions) for `LegalLinkButton` so they open the
	   shared M3 dialog instead of a new tab. Anchors the sanitizer let through
	   whose href does not match a known legal link (a Träger-authored link) are
	   left as plain `<a>` — that is not our decision to override. */
	const renderTraegerHtml = (html: string) =>
		parse(html, {
			replace: (domNode: DOMNode) => {
				const tag = domNode as Element;
				if (
					tag.type !== 'tag' ||
					tag.name !== 'a' ||
					typeof tag.attribs !== 'object'
				) {
					return undefined;
				}
				const href = tag.attribs.href;
				const rawLabel = rawLabelForHref(href);
				if (!rawLabel) {
					return undefined;
				}
				const label =
					(tag.children?.[0] as { data?: string })?.data ?? href;
				return (
					<LegalLinkButton
						variant="inline"
						label={label}
						rawLabel={rawLabel}
						url={href}
						scope="agency"
						agencyId={agency?.id}
						topicId={topic?.id}
					/>
				);
			}
		});

	/* Platform wording applies only when no Träger text is configured. A
	   configured text that cannot be rendered is a fault, not a reason to show
	   different wording than the acceptance binds to (ORISO-Frontend#1110) — the
	   gate in `AccountData` keeps the checkbox disabled for exactly this case.
	
	   Rendering nothing here left a disabled checkbox with no accessible name
	   and no hint that registration cannot continue — a dead end, and the same
	   shape as the pending and unavailable branches the label already handles
	   with a message. Say what happened instead. */
	if (consentText && !traegerSentence) {
		return (
			<span role="alert" data-cy="consent-sentence-unrenderable">
				{t(
					'registration.dataProtection.unrenderable',
					'Der Einwilligungstext dieser Beratungsstelle kann derzeit nicht angezeigt werden. Bitte versuchen Sie es später erneut oder wenden Sie sich an die Beratungsstelle.'
				)}
			</span>
		);
	}

	if (!traegerSentence) {
		return (
			<Typography component="span">
				<LegalLinks
					delimiter={', '}
					filter={(legalLink) => legalLink.registration}
					legalLinks={legalLinks}
					params={{ aid: null }}
					prefix={t('registration.dataProtection.label.prefix')}
					lastDelimiter={t('registration.dataProtection.label.and')}
					suffix={t('registration.dataProtection.label.suffix')}
				>
					{(label, url, rawLabel) => (
						<LegalLinkButton
							variant="inline"
							label={label}
							rawLabel={rawLabel}
							url={url}
							scope="agency"
							agencyId={agency?.id}
							topicId={topic?.id}
						/>
					)}
				</LegalLinks>
			</Typography>
		);
	}

	return (
		<>
			<Typography
				component="span"
				/* Leftover Träger-authored `<a>` (not a platform legal link) stay
				   anchors. Paint them the same as `LegalLinkButton variant="inline"`
				   so a policy link still reads as a link. */
				sx={{
					'display': 'block',
					'& a': {
						color: 'primary.main',
						textDecoration: 'underline'
					}
				}}
				data-cy="consent-sentence-traeger"
			>
				{renderTraegerHtml(traegerSentence.html)}
			</Typography>
			{traegerSentence.isMachineTranslated && (
				<Typography
					component="span"
					variant="body2"
					role="note"
					sx={{
						display: 'block',
						mt: '4px',
						color: 'text.secondary'
					}}
					data-cy="consent-machine-translated"
				>
					{/* The binding language is named from the text's own
					    metadata. The shared `legal.notice.machineTranslated`
					    string asserts German, which is untrue when the Träger
					    authored in another language — a false legal statement
					    beside a consent box is worse than none
					    (ORISO-Frontend#1110). */}
					{t('registration.dataProtection.machineTranslated', {
						language: languageName(
							traegerSentence.originalLang,
							i18n?.language
						),
						defaultValue:
							'Maschinell übersetzt — rechtlich verbindlich ist die Originalfassung ({{language}}).'
					})}
				</Typography>
			)}
			{!traegerSentence.isMachineTranslated &&
				traegerSentence.lang !== normalizeLegalLang(i18n?.language) && (
					<Typography
						component="span"
						variant="body2"
						role="note"
						sx={{
							display: 'block',
							mt: '4px',
							color: 'text.secondary'
						}}
						data-cy="consent-fallback-language"
					>
						{t(
							'legal.notice.fallbackLanguage',
							'Dieser Text liegt nicht in Ihrer Sprache vor und wird in seiner Originalsprache angezeigt.'
						)}
					</Typography>
				)}
			<Typography
				component="span"
				variant="body2"
				sx={{ display: 'block', mt: '4px', color: 'text.secondary' }}
				data-cy="consent-cookie-notice"
			>
				{/* The client owns this wording. ORISO-AgencyService#256 states
				    it explicitly: the cookie/authentication notice "is NOT part
				    of this text: it is a fixed, non-editable addendum the
				    client renders beneath the sentence." So it comes from the
				    catalogue, not from the payload — and a Träger cannot edit
				    it away, which is the point of ADR-021 decision 2. */}
				{t(
					'registration.dataProtection.cookieNotice',
					'Für Authentifizierung und Navigation verwendet diese Webseite Cookies.'
				)}
			</Typography>
		</>
	);
};
