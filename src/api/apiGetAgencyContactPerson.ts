import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';

/**
 * Where the people shown for a centre come from (ORISO-Admin#1534), in the
 * order the UserService resolves them: the centre's own contact person, the
 * Träger default, all admins of the centre, all admins of the Träger, and as
 * last resort the platform's support address (no people at all).
 */
export type AgencyContactSource =
	| 'OWN'
	| 'TRAEGER_DEFAULT'
	| 'FALLBACK_AGENCY_ADMINS'
	| 'FALLBACK_TENANT_ADMINS'
	| 'SUPPORT_EMAIL';

export type AgencyContactRole = 'CONTACT' | 'DEPUTY' | 'ADMIN';

export interface AgencyContactPerson {
	role: AgencyContactRole;
	displayName: string;
	/** Contact e-mail of the admin, or the login e-mail when none is set. */
	email: string;
	/** The admin also counsels at this centre. */
	isConsultant: boolean;
	/** Set only when a chat can be opened with this person (never the caller). */
	chatConsultantId?: string | null;
}

/** `ConsultantAgencyContactDTO` of `GET /users/agencies/{agencyId}/contact-person`. */
export interface AgencyContact {
	source: AgencyContactSource;
	people: AgencyContactPerson[];
	/** The Träger's general contact address, when it has one. */
	traegerContactEmail?: string | null;
}

const SOURCES: ReadonlySet<string> = new Set([
	'OWN',
	'TRAEGER_DEFAULT',
	'FALLBACK_AGENCY_ADMINS',
	'FALLBACK_TENANT_ADMINS',
	'SUPPORT_EMAIL'
]);
const ROLES: ReadonlySet<string> = new Set(['CONTACT', 'DEPUTY', 'ADMIN']);

const toPerson = (entry: unknown): AgencyContactPerson | null => {
	const raw = entry as Partial<AgencyContactPerson> | null;
	if (
		!raw ||
		typeof raw.displayName !== 'string' ||
		!raw.displayName.trim() ||
		!ROLES.has(String(raw.role))
	) {
		return null;
	}
	return {
		role: raw.role as AgencyContactRole,
		displayName: raw.displayName.trim(),
		email: typeof raw.email === 'string' ? raw.email.trim() : '',
		isConsultant: raw.isConsultant === true,
		chatConsultantId:
			typeof raw.chatConsultantId === 'string' && raw.chatConsultantId
				? raw.chatConsultantId
				: null
	};
};

/**
 * Turns the answer into an {@link AgencyContact} the profile can render
 * without further checks. Unknown sources and malformed people are dropped;
 * an answer without anyone to show becomes `SUPPORT_EMAIL`.
 */
export const toAgencyContact = (body: unknown): AgencyContact => {
	const raw = (body ?? {}) as Partial<AgencyContact>;
	const people = Array.isArray(raw.people)
		? raw.people
				.map(toPerson)
				.filter(
					(person): person is AgencyContactPerson => person !== null
				)
		: [];
	const source =
		SOURCES.has(String(raw.source)) && people.length > 0
			? (raw.source as AgencyContactSource)
			: 'SUPPORT_EMAIL';
	const traegerContactEmail =
		typeof raw.traegerContactEmail === 'string' &&
		raw.traegerContactEmail.trim()
			? raw.traegerContactEmail.trim()
			: null;
	return {
		source,
		people: source === 'SUPPORT_EMAIL' ? [] : people,
		traegerContactEmail
	};
};

/**
 * `GET /users/agencies/{agencyId}/contact-person` (ORISO-Admin#1534): whom a
 * counsellor contacts about one of their own centres. A failed request
 * rejects, so the caller can tell "nobody set" from "could not load".
 */
export const apiGetAgencyContactPerson = async (
	agencyId: number
): Promise<AgencyContact> =>
	toAgencyContact(
		await fetchData({
			url: endpoints.agencyContactPerson(agencyId),
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.CATCH_ALL_EXCEPT_UNAUTHORIZED]
		})
	);
