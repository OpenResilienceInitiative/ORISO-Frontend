import { useCallback, useContext } from 'react';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { resolveLegalContent } from '../../utils/legalContent';

/**
 * Which tenant text a legal link points at.
 *
 * The links themselves only carry a translation key and a URL — the text lives
 * on the tenant (`content.impressum` / `content.privacy`, plus the newer
 * language maps). Matching happens on the label key, which is the only stable
 * identifier both sides share.
 */
const LEGAL_CONTENT_BY_LABEL: Record<string, 'impressum' | 'privacy'> = {
	'login.legal.infoText.impressum': 'impressum',
	'login.legal.infoText.dataprotection': 'privacy'
};

export interface LegalLinkContent {
	/** Raw content for `LegalContentRenderer`: language map or plain HTML. */
	content: string;
}

/**
 * Resolves a legal link to the tenant text behind it, or `null` when the
 * operator has not maintained one.
 *
 * `null` is the signal to fall back to the external link — a modal that opens
 * onto the placeholder warning would be worse than the page the link already
 * reaches today.
 */
export const useLegalLinkContent = () => {
	// The context defaults to null: legal links also render on screens that are
	// mounted without a TenantProvider, and those simply have no tenant text.
	const tenant = useContext(TenantContext)?.tenant;

	return useCallback(
		(label: string): LegalLinkContent | null => {
			const kind = LEGAL_CONTENT_BY_LABEL[label];
			if (!kind) {
				return null;
			}

			const languages =
				kind === 'impressum'
					? tenant?.content?.impressumLanguages
					: tenant?.content?.privacyLanguages;
			const resolved =
				kind === 'impressum'
					? tenant?.content?.impressum
					: tenant?.content?.privacy;

			// The language map is preferred (it lets the renderer pick the UI
			// language and show the machine-translation notices); the
			// server-resolved string is the older backends' only field.
			const raw =
				typeof languages === 'string'
					? languages
					: languages && typeof languages === 'object'
						? JSON.stringify(languages)
						: undefined;

			const content = resolveLegalContent(raw, 'de') ? raw : resolved;

			// `resolveLegalContent` returns null only when *no* language holds
			// text, so this also catches an empty map from an unconfigured
			// tenant.
			if (!content || !resolveLegalContent(content, 'de')) {
				return null;
			}

			return { content };
		},
		[tenant]
	);
};
