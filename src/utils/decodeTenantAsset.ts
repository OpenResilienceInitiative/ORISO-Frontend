const NUMERIC_ENTITY = /&#(x[0-9a-f]+|\d+);/gi;

/**
 * Undo the HTML encoding TenantService applies to every stored string, for
 * values that are URLs rather than markup — the branding assets
 * (`theming.logo`, `theming.favicon`, `theming.associationLogo`).
 *
 * TenantService stores `+` as `&#43;` and `=` as `&#61;`. Base64 payloads are
 * full of both, so a stored favicon comes back as
 *
 *   data:image/vnd.microsoft.icon;base64,AAABAAEA…&#43;…&#61;
 *
 * which is not a decodable data URL.
 *
 * Deliberately NOT implemented via `innerHTML` like {@link decodeHTML}: these
 * values are pasted straight into `img[src]` / `link[rel=icon][href]`, so they
 * must never take a detour through markup parsing — `innerHTML` on an
 * admin-editable string is a script-execution sink. A plain numeric-entity
 * decode is both safer and testable outside a DOM.
 *
 * Mirrors ORISO-Admin `src/utils/decodeTenantAsset.ts`.
 */
export const decodeTenantAsset = (
	value?: string | null
): string | undefined => {
	if (!value) return undefined;

	return value
		.replace(NUMERIC_ENTITY, (_match, code: string) =>
			String.fromCharCode(
				code[0].toLowerCase() === 'x'
					? Number.parseInt(code.slice(1), 16)
					: Number.parseInt(code, 10)
			)
		)
		.replace(/&amp;/g, '&');
};

export default decodeTenantAsset;
