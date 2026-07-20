import { Pseudonym } from '../../../utils/anonName/engine';
import { USERNAME_MAX_LENGTH } from '../registrationDataValidation';

/** Slugify a display fragment: strip diacritics, lowercase, ß→ss, collapse any
 *  run of non-alphanumerics into a single underscore, trim edge underscores. */
const slugify = (value: string): string =>
	value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_{2,}/g, '_');

// A 4-digit suffix (1000–9999) keeps the total length predictable (always 5
// characters incl. the separator) and adds ~9k variants on top of the
// animal×name space, so username collisions stay rare. The registration flow
// still verifies availability against the backend as the real uniqueness gate.
const SUFFIX_MIN = 1000;
const SUFFIX_SPAN = 9000;

/**
 * Build the login username from a generated pseudonym.
 *
 * The username is the asker's login credential AND is capped at
 * {@link USERNAME_MAX_LENGTH} (30) by the backend. To stay within that budget we
 * drop the (long) adjective and build the handle from `animal + name` only, e.g.
 * "freundliche Katze Mika" → "katze_mika_1234". Legacy drafts that predate the
 * structured `animalLabel`/`name` fields fall back to the full display name so
 * the result is still valid (just possibly truncated).
 */
export const toRegistrationUsername = (identity: Pseudonym): string => {
	const fromParts = slugify(
		[identity.animalLabel, identity.name].filter(Boolean).join(' ')
	);
	const base = fromParts || slugify(identity.displayName) || 'oriso';

	const suffix = Math.floor(SUFFIX_MIN + Math.random() * SUFFIX_SPAN);
	const suffixText = `_${suffix}`;
	const maxBaseLength = USERNAME_MAX_LENGTH - suffixText.length;

	// Truncate to the budget, then drop any trailing underscore the cut may have
	// left so we never emit "..._" before the numeric suffix.
	const trimmedBase =
		base.slice(0, maxBaseLength).replace(/_+$/, '') || 'oriso';

	return `${trimmedBase}${suffixText}`;
};
