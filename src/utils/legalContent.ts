/**
 * Resolution helpers for multilingual legal content (spec S2).
 *
 * Legal texts (department or tenant level) may arrive in two shapes:
 * 1. A plain HTML string (legacy tenant content) - passed through unchanged.
 * 2. A JSON string with a language->HTML map, e.g.
 *    `{"de":"<p>...</p>","en":"<p>...</p>","en__meta":"{\"mt\":true,\"src\":\"de\",\"at\":\"...\"}"}`
 *    where optional `<lang>__meta` keys carry machine-translation metadata.
 *    Meta keys are NEVER rendered as content.
 */

export interface ResolvedLegalContent {
	html: string;
	/** Language of the returned html */
	lang: string;
	/** True when the returned html is a machine translation */
	isMachineTranslated: boolean;
	/** The original (authored, legally binding) language of the text */
	originalLang: string;
}

interface LegalContentMeta {
	mt?: boolean;
	src?: string;
	at?: string;
}

const META_KEY_SUFFIX = '__meta';
const DEFAULT_ORIGINAL_LANG = 'de';

/**
 * Normalizes an i18n language tag to the bare language code used as map key,
 * e.g. `de-DE` -> `de`, `de@informal` -> `de`.
 */
export const normalizeLegalLang = (lang: string | null | undefined): string =>
	(lang || DEFAULT_ORIGINAL_LANG).split(/[-_@]/)[0].toLowerCase();

const parseMeta = (value: unknown): LegalContentMeta | null => {
	if (value && typeof value === 'object') {
		return value as LegalContentMeta;
	}
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return parsed && typeof parsed === 'object' ? parsed : null;
		} catch {
			return null;
		}
	}
	return null;
};

const parseLanguageMap = (content: string): Record<string, unknown> | null => {
	const trimmed = content.trim();
	// Plain HTML (or anything that is not a JSON object) is passed through.
	if (!trimmed.startsWith('{')) {
		return null;
	}
	try {
		const parsed = JSON.parse(trimmed);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? parsed
			: null;
	} catch {
		return null;
	}
};

/**
 * Resolves the content to show for the user's current UI language.
 *
 * - Picks the UI language from the map when available.
 * - Otherwise falls back to the original language (the language without an
 *   `mt` marker, defaulting to `de`) - the caller should then show a
 *   "displayed in its original language" notice (`lang !== uiLang`).
 * - `isMachineTranslated` signals the caller to show the
 *   "machine translated - the German version is legally binding" notice.
 *
 * Returns null when there is no renderable content at all.
 */
export const resolveLegalContent = (
	content: string | null | undefined,
	uiLang: string
): ResolvedLegalContent | null => {
	if (typeof content !== 'string' || content.trim() === '') {
		return null;
	}

	const requestedLang = normalizeLegalLang(uiLang);
	const map = parseLanguageMap(content);
	if (!map) {
		// Already-resolved HTML: render as-is, no notices apply.
		return {
			html: content,
			lang: requestedLang,
			isMachineTranslated: false,
			originalLang: requestedLang
		};
	}

	const metas: Record<string, LegalContentMeta> = {};
	const htmlByLang: Record<string, string> = {};
	Object.entries(map).forEach(([key, value]) => {
		if (key.endsWith(META_KEY_SUFFIX)) {
			const meta = parseMeta(value);
			if (meta) {
				metas[key.slice(0, -META_KEY_SUFFIX.length)] = meta;
			}
			return;
		}
		if (typeof value === 'string' && value.trim() !== '') {
			htmlByLang[key] = value;
		}
	});

	const contentLangs = Object.keys(htmlByLang);
	if (contentLangs.length === 0) {
		return null;
	}

	// Original language = a language without mt:true meta, preferring `de`.
	const nonMachineTranslated = contentLangs.filter(
		(lang) => metas[lang]?.mt !== true
	);
	const machineTranslationSource = contentLangs.find(
		(lang) =>
			metas[lang]?.mt === true &&
			metas[lang]?.src &&
			htmlByLang[metas[lang].src]
	);
	const originalLang = nonMachineTranslated.includes(DEFAULT_ORIGINAL_LANG)
		? DEFAULT_ORIGINAL_LANG
		: (nonMachineTranslated[0] ??
			(machineTranslationSource
				? metas[machineTranslationSource].src
				: undefined) ??
			(htmlByLang[DEFAULT_ORIGINAL_LANG]
				? DEFAULT_ORIGINAL_LANG
				: contentLangs[0]));

	const lang = htmlByLang[requestedLang] ? requestedLang : originalLang;

	return {
		html: htmlByLang[lang],
		lang,
		isMachineTranslated: metas[lang]?.mt === true,
		originalLang
	};
};

/**
 * Consent display preference (department -> Träger/tenant): use the
 * department's own data privacy policy when it has renderable content,
 * otherwise the tenant content. Returns the winning raw content (still a
 * map or HTML string - render it through resolveLegalContent) plus its
 * source for display decisions.
 */
export const pickConsentPrivacyContent = (
	departmentDpp: string | null | undefined,
	tenantPrivacy: string | null | undefined
): {
	content: string | null;
	source: 'department' | 'tenant' | null;
} => {
	if (resolveLegalContent(departmentDpp, DEFAULT_ORIGINAL_LANG)) {
		return { content: departmentDpp, source: 'department' };
	}
	if (resolveLegalContent(tenantPrivacy, DEFAULT_ORIGINAL_LANG)) {
		return { content: tenantPrivacy, source: 'tenant' };
	}
	return { content: null, source: null };
};
