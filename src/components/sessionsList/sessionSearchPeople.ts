/**
 * People results for the session search menu (#1195, FE#1725).
 *
 * The search finds people, not case rows: one row per role + user + agency
 * (FE#1725 US1). A person maps to every loaded session where they take that
 * role in that agency, so picking her filters the list to all of her cases.
 *
 * One text match (`searchTextMatches`) serves the People panel and the
 * session list, so both agree on names, postcode, topic and role label.
 */

import type {
	ListItemInterface,
	TopicSessionInterface
} from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import type { AvatarIdentity } from '../../utils/avatarChoice';

export type SessionSearchPersonRole = 'asker' | 'consultant';

/**
 * Same fallback the chat uses (`SessionListItemComponent` →  `MessageAvatar`),
 * so one person draws the same animal in the search menu and in the conversation.
 */
export const UNKNOWN_AVATAR_SEED = 'unknown';

export interface SessionSearchPeopleLabels {
	asker: string;
	consultant: string;
	unknown: string;
}

export interface SessionSearchPersonResult {
	/** `<role>:<userId>:<agencyId>` */
	id: string;
	/** Public name (counsellor profile name, client username). */
	name: string;
	/** Counsellor's internal name (C1 `internalName`, or first + last). */
	internalName?: string;
	subtitle: string;
	role: SessionSearchPersonRole;
	agencyId?: number;
	agencyName?: string;
	/** Stable per-person key for the generated animal avatar (JOB4). */
	avatarSeed: string;
	/** Counsellor's saved avatar choice; renders on the primary pair. */
	avatar?: AvatarIdentity;
	/** Server query that finds this person's cases (username). */
	lookupQuery?: string;
	/** Sessions this person takes part in, as `sessionSearchKeyOf`. */
	sessionKeys: string[];
	/** Lower-case haystack: names, role, agency, postcodes, topics. */
	searchText: string;
}

export type SessionToolbarPair = {
	raw: ListItemInterface;
	extended: ExtendedSessionInterface;
};

/** A counsellor from the agency-consultant endpoint (role-word search). */
export interface SessionSearchAgencyConsultant {
	consultantId: string;
	username?: string;
	displayName?: string;
	firstName?: string;
	lastName?: string;
	agencyId: number;
	agencyName?: string;
}

/** Session id as the list knows it; ties people back to sessions. */
export const sessionSearchKeyOf = (
	raw: ListItemInterface,
	extended?: Pick<ExtendedSessionInterface, 'item'>
): string =>
	String(raw.session?.id || raw.chat?.id || '') ||
	String(raw.chat?.matrixRoomId || '') ||
	String(extended?.item?.id || '');

const agencyOf = (raw: ListItemInterface) => ({
	agencyId: raw.agency?.id ?? raw.session?.agencyId,
	agencyName: raw.agency?.name
});

const personKey = (
	role: SessionSearchPersonRole,
	userId: string,
	agencyId: number | undefined
) => `${role}:${userId}:${agencyId ?? '-'}`;

type ConsultantLike = NonNullable<ListItemInterface['consultant']> & {
	internalName?: string | null;
};

const consultantIdOf = (consultant?: ConsultantLike) =>
	consultant?.consultantId || consultant?.id || consultant?.username || '';

const askerIdOf = (raw: ListItemInterface) =>
	raw.session?.askerMatrixUserId || raw.user?.username || '';

const internalNameOf = (consultant?: {
	internalName?: string | null;
	firstName?: string;
	lastName?: string;
}) =>
	consultant?.internalName ||
	[consultant?.firstName, consultant?.lastName].filter(Boolean).join(' ') ||
	undefined;

/** Person keys of everyone taking part in this session. */
export const personKeysOfSession = (raw: ListItemInterface): string[] => {
	const { agencyId } = agencyOf(raw);
	const keys: string[] = [];
	const askerId = raw.user ? askerIdOf(raw) : '';
	if (askerId) keys.push(personKey('asker', askerId, agencyId));
	const consultantId = consultantIdOf(raw.consultant as ConsultantLike);
	if (consultantId)
		keys.push(personKey('consultant', consultantId, agencyId));
	return keys;
};

/** Single agency axis (FE#1725 US12). `null` means no agency filter. */
export const sessionMatchesAgency = (
	raw: ListItemInterface,
	selectedAgencyId: string | null | undefined
): boolean =>
	!selectedAgencyId ||
	String(agencyOf(raw).agencyId ?? '') === String(selectedAgencyId);

/** Person axis: several people combine with OR. */
export const sessionMatchesPeople = (
	raw: ListItemInterface,
	selectedPersonIds: string[]
): boolean =>
	!selectedPersonIds.length ||
	personKeysOfSession(raw).some((key) => selectedPersonIds.includes(key));

/* ---------- text match ---------- */

const normalizeRoleWord = (value: string) =>
	value
		.toLowerCase()
		.replace(/[:*_/·.-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

/** de + en words that mean "a counsellor" or "an advice seeker". */
const ROLE_WORDS: Record<SessionSearchPersonRole, string[]> = {
	consultant: [
		'berater:in',
		'beraterin',
		'berater',
		'beraterinnen',
		'beratende person',
		'beratende personen',
		'beratende',
		'beratender',
		'counsellor',
		'counsellors',
		'counselor',
		'counselors',
		'consultant',
		'consultants'
	].map(normalizeRoleWord),
	asker: [
		'ratsuchende:r',
		'ratsuchende',
		'ratsuchender',
		'ratsuchende person',
		'klient:in',
		'klientin',
		'klient',
		'advice seeker',
		'advice seekers',
		'client',
		'clients'
	].map(normalizeRoleWord)
};

/** The role a query names, if it is a role word (FE#1725 US6). */
export const roleOfSearchWord = (
	query: string
): SessionSearchPersonRole | null => {
	const word = normalizeRoleWord(query);
	if (!word) return null;
	if (ROLE_WORDS.consultant.includes(word)) return 'consultant';
	if (ROLE_WORDS.asker.includes(word)) return 'asker';
	return null;
};

/** The one text match for the People panel and the session list. */
export const searchTextMatches = (haystack: string, query: string) => {
	const needle = query.trim().toLowerCase();
	return !needle || haystack.toLowerCase().includes(needle);
};

const topicNameOf = (
	raw: ListItemInterface,
	extended?: Pick<ExtendedSessionInterface, 'item'>
) => {
	const topic = (raw.session?.topic ??
		raw.chat?.topic ??
		extended?.item?.topic) as TopicSessionInterface | string | undefined;
	return typeof topic === 'string' ? topic : topic?.name;
};

/**
 * Metadata-only haystack of a session. Matrix/E2EE message bodies must never
 * affect search results.
 */
export const sessionSearchText = (
	raw: ListItemInterface,
	extended?: Pick<ExtendedSessionInterface, 'item'>
): string => {
	const consultant = raw.consultant as ConsultantLike | undefined;
	return [
		topicNameOf(raw, extended),
		raw.user?.username,
		raw.user?.displayName,
		consultant?.displayName,
		consultant?.username,
		consultant?.firstName,
		consultant?.lastName,
		consultant?.internalName,
		raw.agency?.name,
		raw.session?.postcode !== undefined && raw.session?.postcode !== null
			? String(raw.session.postcode)
			: undefined
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
};

/** Text axis of the session list; a role word keeps sessions with that role. */
export const sessionMatchesSearchText = (
	raw: ListItemInterface,
	extended: Pick<ExtendedSessionInterface, 'item'> | undefined,
	query: string
): boolean => {
	if (!query.trim()) return true;
	const role = roleOfSearchWord(query);
	if (role === 'asker') return Boolean(raw.user);
	if (role === 'consultant') return Boolean(raw.consultant);
	return searchTextMatches(sessionSearchText(raw, extended), query);
};

/**
 * Narrows the People panel. A role word lists everyone with that role; any
 * other text matches names, role, agency, and the person's postcodes/topics.
 * Selection state never removes rows (JOB7).
 */
export function filterSearchPeople<
	T extends {
		name: string;
		subtitle: string;
		role?: SessionSearchPersonRole;
		searchText?: string;
	}
>(people: T[], query: string): T[] {
	if (!query.trim()) {
		return people;
	}
	const role = roleOfSearchWord(query);
	if (role) {
		return people.filter((entry) => entry.role === role);
	}
	return people.filter((entry) =>
		searchTextMatches(
			entry.searchText ?? `${entry.name} ${entry.subtitle}`,
			query
		)
	);
}

/** True when the query looks up one of these people by name. */
export const queryNamesPerson = (
	people: { name: string; internalName?: string }[],
	query: string
) =>
	Boolean(query.trim()) &&
	(roleOfSearchWord(query) !== null ||
		people.some((person) =>
			searchTextMatches(
				`${person.name} ${person.internalName || ''}`,
				query
			)
		));

const subtitleOf = (roleLabel: string, agencyName: string | undefined) =>
	[roleLabel, agencyName].filter(Boolean).join(' | ');

export function buildSearchPeopleResults(
	pairs: SessionToolbarPair[],
	labels: SessionSearchPeopleLabels,
	options: {
		/** Names the signed-in counsellor, whose own rows carry no name. */
		currentUser?: { id: string; name?: string };
		/** Counsellors from the agency-consultant endpoint (role words). */
		agencyConsultants?: SessionSearchAgencyConsultant[];
	} = {}
): SessionSearchPersonResult[] {
	const byKey = new Map<
		string,
		SessionSearchPersonResult & { parts: Set<string> }
	>();

	const upsert = (
		key: string,
		create: () => SessionSearchPersonResult,
		sessionKey?: string,
		sessionText?: string
	) => {
		let entry = byKey.get(key);
		if (!entry) {
			entry = { ...create(), parts: new Set<string>() };
			byKey.set(key, entry);
		}
		if (sessionKey && !entry.sessionKeys.includes(sessionKey)) {
			entry.sessionKeys.push(sessionKey);
		}
		if (sessionText) entry.parts.add(sessionText);
		return entry;
	};

	pairs.forEach(({ raw, extended }) => {
		const sessionKey = sessionSearchKeyOf(raw, extended);
		if (!sessionKey) {
			return;
		}
		const { agencyId, agencyName } = agencyOf(raw);
		const postcode =
			raw.session?.postcode !== undefined &&
			raw.session?.postcode !== null
				? String(raw.session.postcode)
				: '';
		const sessionParts = [postcode, topicNameOf(raw, extended)]
			.filter(Boolean)
			.join(' ');

		// A role the session does not carry produces no row at all; a person
		// who is present but nameless keeps a row under the "unknown" label.
		if (raw.user) {
			const askerId = askerIdOf(raw) || UNKNOWN_AVATAR_SEED;
			const key = personKey('asker', askerId, agencyId);
			upsert(
				key,
				() => ({
					id: key,
					name:
						raw.user.displayName ||
						raw.user.username ||
						labels.unknown,
					subtitle: subtitleOf(labels.asker, agencyName),
					role: 'asker',
					agencyId,
					agencyName,
					avatarSeed:
						raw.session?.askerMatrixUserId ||
						raw.user.username ||
						UNKNOWN_AVATAR_SEED,
					sessionKeys: [],
					searchText: ''
				}),
				sessionKey,
				sessionParts
			);
		}
		const consultant = raw.consultant as ConsultantLike | undefined;
		if (consultant) {
			const consultantId =
				consultantIdOf(consultant) || UNKNOWN_AVATAR_SEED;
			const key = personKey('consultant', consultantId, agencyId);
			const isMe =
				options.currentUser &&
				String(options.currentUser.id) === String(consultantId);
			const entry = upsert(
				key,
				() => ({
					id: key,
					name:
						consultant.displayName ||
						(isMe && options.currentUser?.name) ||
						consultant.username ||
						labels.unknown,
					internalName: internalNameOf(consultant),
					subtitle: subtitleOf(labels.consultant, agencyName),
					role: 'consultant',
					agencyId,
					agencyName,
					avatarSeed: consultantId,
					avatar: {
						avatarKind: consultant.avatarKind,
						avatarId: consultant.avatarId
					},
					lookupQuery: consultant.username || consultant.displayName,
					sessionKeys: [],
					searchText: ''
				}),
				sessionKey,
				sessionParts
			);
			entry.internalName ||= internalNameOf(consultant);
			entry.agencyName ||= agencyName;
			entry.subtitle = subtitleOf(labels.consultant, entry.agencyName);
		}
	});

	(options.agencyConsultants ?? []).forEach((consultant) => {
		const key = personKey(
			'consultant',
			consultant.consultantId,
			consultant.agencyId
		);
		const entry = upsert(key, () => ({
			id: key,
			name:
				consultant.displayName || consultant.username || labels.unknown,
			internalName: internalNameOf(consultant),
			subtitle: subtitleOf(labels.consultant, consultant.agencyName),
			role: 'consultant',
			agencyId: consultant.agencyId,
			agencyName: consultant.agencyName,
			avatarSeed: consultant.consultantId,
			avatar: {},
			lookupQuery: consultant.username || consultant.displayName,
			sessionKeys: [],
			searchText: ''
		}));
		entry.internalName ||= internalNameOf(consultant);
		entry.agencyName ||= consultant.agencyName;
		entry.subtitle = subtitleOf(labels.consultant, entry.agencyName);
	});

	return Array.from(byKey.values()).map(({ parts, ...person }) => ({
		...person,
		searchText: [
			person.name,
			person.internalName,
			person.subtitle,
			...Array.from(parts)
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase()
	}));
}
