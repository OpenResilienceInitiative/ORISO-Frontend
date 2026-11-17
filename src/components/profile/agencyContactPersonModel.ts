import type {
	AgencyContact,
	AgencyContactPerson,
	AgencyContactRole
} from '../../api/apiGetAgencyContactPerson';

const KEY = 'profile.data.agency.contactPerson';

/**
 * One plain address only. Only an address that passes this check becomes a
 * `mailto:` link, so anything that could add recipients, headers or a body (`?`, `&`,
 * `,`, `;`, whitespace, angle brackets) is rejected rather than escaped. `%` is
 * rejected too: a mail client decodes it, so `a%2Bb@x` would write to a
 * different mailbox than shown. A rejected address of a contact person is shown
 * as text, without a link; a rejected platform support address is not shown at
 * all, and the profile names the platform administration instead.
 */
const PLAIN_EMAIL_PATTERN =
	/^[^\s@?&#,;<>"'%]+@[^\s@?&#,;<>"'%]+\.[^\s@?&#,;<>"'%]+$/;

export const toMailAddress = (value: unknown): string | null => {
	const email = typeof value === 'string' ? value.trim() : '';
	return PLAIN_EMAIL_PATTERN.test(email) ? email : null;
};

/**
 * An admin without a name is listed by the e-mail address (UserService). Then
 * name and address are the same string, and the address is shown once.
 */
export const nameIsEmail = (
	person: Pick<AgencyContactPerson, 'displayName' | 'email'>
): boolean => {
	const name = (person.displayName ?? '').trim().toLowerCase();
	const email = (person.email ?? '').trim().toLowerCase();
	return name === '' || (email !== '' && name === email);
};

/** A line above the people saying why they are shown; none for the centre's own contact. */
export const headingKeyFor = (source: AgencyContact['source']) => {
	switch (source) {
		case 'TRAEGER_DEFAULT':
			return `${KEY}.traegerDefault`;
		case 'FALLBACK_AGENCY_ADMINS':
		case 'FALLBACK_TENANT_ADMINS':
			return `${KEY}.fallback.heading`;
		case 'SUPPORT_EMAIL':
			return `${KEY}.support.heading`;
		default:
			return null;
	}
};

/** Which admins the fallback lists: those of the centre or those of the Träger. */
export const fallbackGroupKeyFor = (source: AgencyContact['source']) => {
	if (source === 'FALLBACK_AGENCY_ADMINS')
		return `${KEY}.fallback.agencyAdmins`;
	if (source === 'FALLBACK_TENANT_ADMINS')
		return `${KEY}.fallback.tenantAdmins`;
	return null;
};

/** Only the deputy carries a role label; the contact is the tile's own title. */
export const roleLabelKeyFor = (role: AgencyContactRole) =>
	role === 'DEPUTY' ? `${KEY}.deputy` : null;

export const showsCounsellorBadge = (person: AgencyContactPerson) =>
	person.isConsultant;

/** A chat needs a reachable counsellor identity; the UserService never names the caller. */
export const canStartChat = (person: AgencyContactPerson) =>
	Boolean(person.chatConsultantId);

const ROLE_ORDER: Record<AgencyContactRole, number> = {
	CONTACT: 0,
	DEPUTY: 1,
	ADMIN: 2
};

/** Contact before deputy; admins of a fallback keep the order the service sent. */
export const orderedPeople = (people: AgencyContactPerson[]) =>
	people
		.map((person, index) => ({ person, index }))
		.sort(
			(a, b) =>
				ROLE_ORDER[a.person.role] - ROLE_ORDER[b.person.role] ||
				a.index - b.index
		)
		.map(({ person }) => person);
