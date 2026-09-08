import { isAnonymousMatrixUsername } from '../../utils/anonymousChatDisplayName';

const normalizeMatrixLikeValue = (rawValue?: string) => {
	const value = (rawValue || '').trim();
	if (!value) {
		return '';
	}

	let normalized = value;
	if (normalized.startsWith('@')) {
		normalized = normalized.slice(1);
	}
	if (normalized.includes(':')) {
		normalized = normalized.split(':')[0];
	}
	// Email-style identifiers (testuser@example.invalid): keep the local part.
	if (normalized.includes('@')) {
		normalized = normalized.split('@')[0];
	}
	return normalized.trim();
};

// Technical usernames ("free_bee_frankie_821") must never surface in the chat
// UI — turn them into a readable name ("free bee frankie") instead. Names
// that already contain a space are user-configured display names (technical
// Matrix identifiers cannot contain spaces) — leave their punctuation alone
// ("Dr. Kim" stays "Dr. Kim").
const humanizeTechnicalName = (value: string) => {
	if (/\s/.test(value) || !/[_.]/.test(value)) {
		return value;
	}
	const words = value
		.split(/[_.]+/)
		.map((word) => word.trim())
		.filter(Boolean);
	if (words.length > 1 && /^\d+$/.test(words[words.length - 1])) {
		words.pop();
	}
	return words.join(' ') || value;
};

const resolvePreferredName = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => {
	const normalizedFirstName = (firstName || '').trim();
	const normalizedLastName = (lastName || '').trim();
	const combinedRealName =
		`${normalizedFirstName} ${normalizedLastName}`.trim();
	if (combinedRealName) {
		return combinedRealName;
	}

	const normalizedDisplayName = normalizeMatrixLikeValue(rawDisplayName);
	if (normalizedDisplayName) {
		return humanizeTechnicalName(normalizedDisplayName);
	}

	// An anonymous User-ID is the platform's identity anchor (#1209), not a
	// technical name to prettify. Humanising it drops the trailing digits, so
	// every guest in a room collapses to the same bare word — `anon_5` and
	// `anon_12` both render as "anon" — and the bubble stops matching the
	// header and the session list, which already show it raw.
	const normalizedUsername = normalizeMatrixLikeValue(rawUsername);
	if (isAnonymousMatrixUsername(normalizedUsername)) {
		return normalizedUsername;
	}

	return humanizeTechnicalName(normalizedUsername);
};

export const formatMessagePersonName = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => resolvePreferredName(rawDisplayName, rawUsername, firstName, lastName);

export type IncomingConsultantNameForAsker = {
	displayName?: string;
	firstName?: string;
	lastName?: string;
};

/**
 * Asker-facing incoming consultant names (#1146).
 *
 * Prefer the session DTO public `displayName` over Matrix member/event names.
 * When that public name is set, omit first/last so `formatMessagePersonName`
 * cannot prefer the legal name. Fallback: Matrix name → event name → username.
 *
 * Does not change `resolvePreferredName`; consultant-internal surfaces keep
 * legal-name-first behaviour.
 */
export const resolveIncomingConsultantNameForAsker = ({
	sessionConsultantDisplayName,
	matrixDisplayName,
	eventDisplayName,
	username
}: {
	sessionConsultantDisplayName?: string;
	matrixDisplayName?: string;
	eventDisplayName?: string;
	username?: string;
}): IncomingConsultantNameForAsker => {
	const publicDisplayName = (sessionConsultantDisplayName || '').trim();
	if (publicDisplayName) {
		return { displayName: publicDisplayName };
	}

	const matrixName = (matrixDisplayName || '').trim();
	if (matrixName) {
		return { displayName: matrixName };
	}

	const eventName = (eventDisplayName || '').trim();
	if (eventName) {
		return { displayName: eventName };
	}

	const fallbackUsername = (username || '').trim();
	return fallbackUsername ? { displayName: fallbackUsername } : {};
};

export type OwnConsultantName = {
	displayName?: string;
	firstName?: string;
	lastName?: string;
};

/**
 * Counsellor self-view names (#1146).
 *
 * Prefer the chosen public `displayName` from userData. When it is set, omit
 * first/last so `formatMessagePersonName` cannot prefer the legal name.
 * Fallback: firstName + lastName → username.
 *
 * Does not change `resolvePreferredName`; consultant-internal surfaces keep
 * legal-name-first behaviour.
 */
export const resolveOwnConsultantName = ({
	displayName,
	firstName,
	lastName,
	username
}: {
	displayName?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}): OwnConsultantName => {
	const publicDisplayName = (displayName || '').trim();
	if (publicDisplayName) {
		return { displayName: publicDisplayName };
	}

	const normalizedFirstName = (firstName || '').trim();
	const normalizedLastName = (lastName || '').trim();
	if (normalizedFirstName || normalizedLastName) {
		return {
			firstName: normalizedFirstName || undefined,
			lastName: normalizedLastName || undefined
		};
	}

	const fallbackUsername = (username || '').trim();
	return fallbackUsername ? { displayName: fallbackUsername } : {};
};

/**
 * The counselling centre a message speaks for: `"54222 Caritas Mainz"`.
 *
 * Rendered as the second line of the message sender header (Figma "Message
 * Recipient Header", App.Oriso 9229:24595). For someone who picked their
 * agency by postcode during registration, this is the one line that confirms
 * they are talking to the place they chose.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#895.
 */
export const formatAgencyLine = (
	agency?: { postcode?: string | number | null; name?: string | null } | null
): string => {
	const name = `${agency?.name ?? ''}`.trim();
	if (!name) {
		// A postcode with no place name says nothing — show nothing.
		return '';
	}
	const postcode = `${agency?.postcode ?? ''}`.trim();
	// Live Chat registers anonymous askers with the placeholder "00000";
	// printing it would name a place that does not exist.
	if (!postcode || /^0+$/.test(postcode)) {
		return name;
	}
	return `${postcode} ${name}`;
};

/**
 * The same line, resolved through the `agencies` i18n namespace first, so a
 * tenant-specific name override wins. The chat header and the message sender
 * header must never disagree about what the counselling centre is called.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#895.
 */
export const formatAgencyLineWithI18n = (
	agency:
		| {
				id?: number;
				postcode?: string | number | null;
				name?: string | null;
		  }
		| null
		| undefined,
	translate: (keys: [string, string], options: { ns: 'agencies' }) => string
): string => {
	if (!agency) {
		return formatAgencyLine(agency);
	}
	const name =
		agency.id != null
			? translate([`agency.${agency.id}.name`, agency.name ?? ''], {
					ns: 'agencies'
				})
			: (agency.name ?? '');
	return formatAgencyLine({
		postcode: agency.postcode,
		name
	});
};
