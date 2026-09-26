/**
 * A Träger's own legal pages have no Beratungsstelle, so no server fills
 * `{{Datenschutzbeauftragte}}` there (AgencyService does it for agency
 * pages, where the Beratungsstelle's own DPO overrides the Träger's).
 * The Träger's DPO is public on purpose (Art. 37(7) GDPR), ORISO-Admin#1067.
 */
export interface TraegerDpo {
	nameAndLegalForm?: string | null;
	street?: string | null;
	postcode?: string | null;
	city?: string | null;
	phoneNumber?: string | null;
	email?: string | null;
}

const TOKEN = '{{Datenschutzbeauftragte}}';

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const clean = (value?: string | null) => (value ?? '').trim();

/** Same one-line shape AgencyService renders: "Name, Street, PLZ City, Phone, E-Mail". */
export const traegerDpoLine = (dpo?: TraegerDpo | null): string => {
	if (!dpo || !clean(dpo.nameAndLegalForm)) return '';
	const place = [clean(dpo.postcode), clean(dpo.city)]
		.filter(Boolean)
		.join(' ');
	return [
		clean(dpo.nameAndLegalForm),
		clean(dpo.street),
		place,
		clean(dpo.phoneNumber),
		clean(dpo.email)
	]
		.filter(Boolean)
		.join(', ');
};

const substitute = (text: string, line: string) =>
	text.split(TOKEN).join(escapeHtml(line));

/**
 * Fills the token in a flat HTML string or inside a language map (object or
 * its JSON string). `__meta` keys are metadata, not prose, and stay untouched.
 */
export function withTraegerDpo<T extends string | Record<string, string>>(
	content: T | null | undefined,
	dpo?: TraegerDpo | null
): T | null | undefined {
	if (!content) return content;
	const line = traegerDpoLine(dpo);
	const fillMap = (map: Record<string, string>) =>
		Object.fromEntries(
			Object.entries(map).map(([key, value]) => [
				key,
				key.endsWith('__meta') || typeof value !== 'string'
					? value
					: substitute(value, line)
			])
		);
	if (typeof content === 'object') {
		return fillMap(content) as T;
	}
	if (!content.includes(TOKEN)) return content;
	try {
		const parsed = JSON.parse(content);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return JSON.stringify(fillMap(parsed)) as T;
		}
	} catch {
		// Not a language map: a plain HTML string.
	}
	return substitute(content, line) as T;
}
