import { useTranslation } from 'react-i18next';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { resolveLegalContent } from '../../utils/legalContent';

export type LegalLinkKind = 'imprint' | 'privacy';

/**
 * The legal links are configured as label/url pairs, not as typed entries, so
 * the kind has to be derived from the label and the target path. Kept in one
 * place so the modal and the link buttons never disagree about it.
 */
export const getLegalLinkKind = (title: string, url: string): LegalLinkKind => {
	const source = `${title} ${url}`.toLowerCase();
	return source.includes('daten') ||
		source.includes('privacy') ||
		source.includes('datenschutz')
		? 'privacy'
		: 'imprint';
};

/**
 * Resolves the tenant-authored legal text behind a legal link.
 *
 * Content preference mirrors {@link ../legalPageWrapper/LegalPageWrapper}:
 * the raw multilingual map (`content.impressumLanguages` /
 * `content.privacyLanguages`) wins over the server-resolved flat string, so
 * the UI language is honoured on backends that deliver it.
 *
 * `content` is `null` whenever the platform operator has not authored the
 * text yet. Callers on public pages use that to fall back to opening the
 * legal URL instead of showing an empty dialog.
 */
export const useLegalLinkContent = (title: string, url: string) => {
	const tenant = useTenant();
	const { i18n } = useTranslation();
	const kind = getLegalLinkKind(title, url);

	const rawMap =
		kind === 'privacy'
			? tenant?.content?.privacyLanguages
			: tenant?.content?.impressumLanguages;
	const flat =
		kind === 'privacy'
			? tenant?.content?.privacy
			: tenant?.content?.impressum;

	const rawString = rawMap ? JSON.stringify(rawMap) : undefined;
	const uiLang = i18n.language || 'de';
	const content = resolveLegalContent(rawString, uiLang)
		? rawString
		: resolveLegalContent(flat, uiLang)
			? flat
			: null;

	return { kind, content: content ?? null };
};
