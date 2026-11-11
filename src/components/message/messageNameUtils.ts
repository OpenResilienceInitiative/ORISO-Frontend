import { decodeUsername } from '../../utils/encryptionHelpers';

// Matrix names of anonymous askers are encoded ("enc.mfxg63s7gezte...");
// shown as they are they read "enc.mfxg63s7gezte" (#1839).
const decodeEncodedName = (value: string) => {
	if (!value.startsWith('enc.')) {
		return value;
	}
	try {
		return decodeUsername(value).trim() || value;
	} catch {
		return value;
	}
};

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
	return decodeEncodedName(normalized.trim());
};

/**
 * Which name a person is published under (#1486).
 *
 * ADR-002 §2: the published identity is the public display name. A
 * counsellor's legal name is staff data, not an identity the platform shows —
 * it used to be checked first here, so wherever `firstName`/`lastName` reached
 * this function the bubble overrode the display name the counsellor publishes
 * and named them to the advice seeker.
 *
 * The order is therefore:
 *   1. the public display name,
 *   2. the identity anchor — the Matrix/User-ID the chat header and the
 *      session list already show,
 *   3. the real name, and only when the person has neither of the above, so
 *      the line is never blank.
 *
 * Both names are shown exactly as written (#1209, #1494). Turning
 * `quiet_otter_6824` into "quiet otter" dropped the digits, so the bubble no
 * longer matched the header and two people could read the same.
 *
 * Callers on advice-seeker-facing surfaces must not supply the real name at
 * all; see `MessageItemComponent`.
 */
const resolvePreferredName = (
	rawDisplayName?: string,
	rawUsername?: string,
	firstName?: string,
	lastName?: string
) => {
	const name =
		normalizeMatrixLikeValue(rawDisplayName) ||
		normalizeMatrixLikeValue(rawUsername);
	if (name) {
		return name;
	}

	// Last resort only: no published name and no identity anchor at all.
	const normalizedFirstName = (firstName || '').trim();
	const normalizedLastName = (lastName || '').trim();
	return `${normalizedFirstName} ${normalizedLastName}`.trim();
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
 * Since #1486 `resolvePreferredName` no longer prefers the legal name either;
 * this helper keeps it from being supplied at all on the asker-facing path.
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
 * Fallback: username → firstName + lastName, so a counsellor without a public
 * display name reads the same in the bubble, the chat header and the session list.
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

	const fallbackUsername = (username || '').trim();
	if (fallbackUsername) {
		return { displayName: fallbackUsername };
	}

	const normalizedFirstName = (firstName || '').trim();
	const normalizedLastName = (lastName || '').trim();
	return normalizedFirstName || normalizedLastName
		? {
				firstName: normalizedFirstName || undefined,
				lastName: normalizedLastName || undefined
			}
		: {};
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
