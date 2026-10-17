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
import { decodeUsername } from '../../utils/encryptionHelpers';

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
	/**
	 * A colleague whose cases the signed-in counsellor may take over
	 * (FE#1152). Only these are listed while the search text is blank.
	 */
	eligible?: boolean;
}

export type SessionToolbarPair = {
	raw: ListItemInterface;
	extended: ExtendedSessionInterface;
};

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

const postcodeOf = (raw: ListItemInterface) =>
	raw.session?.postcode !== undefined && raw.session?.postcode !== null
		? String(raw.session.postcode)
		: '';

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

/** Never show an `enc.` username; empty stays empty. */
const readable = (name?: string | null) =>
	name ? decodeUsername(name).trim() : '';

/**
 * Name shown for a counsellor (rows, chips, avatar initials): the public
 * name, unless it is only her username; then the internal name; then the
 * decoded username.
 */
const consultantNameOf = (
	consultant: {
		displayName?: string;
		username?: string;
		internalName?: string | null;
		firstName?: string;
		lastName?: string;
	},
	ownName?: string
) => {
	const username = readable(consultant.username);
	const publicName = readable(consultant.displayName);
	return (
		(publicName !== username && publicName) ||
		readable(internalNameOf(consultant)) ||
		ownName ||
		username
	);
};

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
export const agencyMatches = (
	agencyId: number | string | null | undefined,
	selectedAgencyId: string | null | undefined
): boolean =>
	!selectedAgencyId || String(agencyId ?? '') === String(selectedAgencyId);

export const sessionMatchesAgency = (
	raw: ListItemInterface,
	selectedAgencyId: string | null | undefined
): boolean => agencyMatches(agencyOf(raw).agencyId, selectedAgencyId);

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
		readable(consultant?.username),
		consultant?.firstName,
		consultant?.lastName,
		consultant?.internalName,
		raw.agency?.name,
		postcodeOf(raw)
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
 * Narrows the People panel. A blank query lists everyone, or with
 * `eligibleOnlyWhenBlank` only the eligible colleagues. A role word lists
 * everyone with that role; any
 * other text matches names, role, agency, and the person's postcodes/topics.
 * Selection state never removes rows (JOB7).
 */
export function filterSearchPeople<
	T extends {
		name: string;
		subtitle: string;
		role?: SessionSearchPersonRole;
		searchText?: string;
		eligible?: boolean;
	}
>(
	people: T[],
	query: string,
	options: {
		/**
		 * A blank query lists only the eligible colleagues (FE#1152); own
		 * clients and the signed-in counsellor need a search text.
		 */
		eligibleOnlyWhenBlank?: boolean;
	} = {}
): T[] {
	if (!query.trim()) {
		return options.eligibleOnlyWhenBlank
			? people.filter((entry) => entry.eligible)
			: people;
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

type NamedPerson = {
	name: string;
	internalName?: string;
	lookupQuery?: string;
};

const nameWordsOf = (person: NamedPerson) =>
	[person.name, person.internalName, person.lookupQuery]
		.filter(Boolean)
		.flatMap((name) => {
			const lower = String(name).toLowerCase();
			return [lower, ...lower.split(/\s+/)];
		});

/**
 * Text axis of the list while people are picked (FE#1725 US3): words that
 * name a picked person (whole name or a word prefix) or are role words only
 * looked her up and stop narrowing; the other words keep narrowing (AND),
 * e.g. "patty 13055" narrows Patty's cases to postcode 13055.
 */
export const textAxisQuery = (
	query: string,
	pickedPeople: NamedPerson[]
): string => {
	if (!query.trim() || !pickedPeople.length) return query;
	if (roleOfSearchWord(query) !== null) return '';
	const nameWords = pickedPeople.flatMap(nameWordsOf);
	const needle = query.trim().toLowerCase();
	if (nameWords.some((word) => word.startsWith(needle))) return '';
	return query
		.trim()
		.split(/\s+/)
		.filter((word) => {
			const lower = word.toLowerCase();
			return (
				roleOfSearchWord(word) === null &&
				!nameWords.some((name) => name.startsWith(lower))
			);
		})
		.join(' ');
};

/** Server queries that find all of a person's cases: username, else names. */
export const lookupTermsOf = (person: NamedPerson): string[] =>
	person.lookupQuery
		? [person.lookupQuery]
		: Array.from(
				new Set(
					[person.name, person.internalName].filter(
						(name): name is string => Boolean(name)
					)
				)
			);

const subtitleOf = (roleLabel: string, agencyName: string | undefined) =>
	[roleLabel, agencyName].filter(Boolean).join(' | ');

/** Postcode and topic of a case; they make its people findable by them. */
const sessionPartsOf = (
	raw: ListItemInterface,
	extended?: Pick<ExtendedSessionInterface, 'item'>
) => [postcodeOf(raw), topicNameOf(raw, extended)].filter(Boolean).join(' ');

export function buildSearchPeopleResults(
	pairs: SessionToolbarPair[],
	labels: SessionSearchPeopleLabels,
	options: {
		/** Names the signed-in counsellor, whose own rows carry no name. */
		currentUser?: { id: string; name?: string };
		/**
		 * Cases the signed-in counsellor may take over (blank candidates
		 * query, FE#1152). Only their counsellors become rows, never the
		 * clients; these rows are marked `eligible`, and only they are
		 * listed while the search text is blank. When given, no other
		 * counsellor becomes a row: an own-list case only enriches an
		 * eligible colleague, and the signed-in counsellor never appears.
		 */
		eligibleCases?: ListItemInterface[];
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

	/** One row per counsellor + agency, from a session or an eligible case. */
	const upsertConsultant = (
		consultant: {
			consultantId: string;
			username?: string;
			displayName?: string;
			firstName?: string;
			lastName?: string;
			internalName?: string | null;
			avatar?: AvatarIdentity;
		},
		agencyId: number | undefined,
		agencyName: string | undefined,
		sessionKey?: string,
		sessionParts?: string,
		eligible = false
	) => {
		const key = personKey('consultant', consultant.consultantId, agencyId);
		const isMe =
			options.currentUser &&
			String(options.currentUser.id) === String(consultant.consultantId);
		const entry = upsert(
			key,
			() => ({
				id: key,
				name:
					consultantNameOf(
						consultant,
						isMe ? options.currentUser?.name : undefined
					) || labels.unknown,
				subtitle: '',
				role: 'consultant',
				agencyId,
				avatarSeed: consultant.consultantId,
				avatar: consultant.avatar ?? {},
				lookupQuery: consultant.username || consultant.displayName,
				sessionKeys: [],
				searchText: ''
			}),
			sessionKey,
			sessionParts
		);
		// The signed-in counsellor is never a colleague to take over from.
		if (eligible && !isMe) entry.eligible = true;
		entry.internalName ||=
			readable(internalNameOf(consultant)) || undefined;
		entry.agencyName ||= agencyName;
		entry.subtitle = subtitleOf(labels.consultant, entry.agencyName);
	};

	/** The counsellor of a case, as a row of her own. */
	const upsertSessionConsultant = (
		raw: ListItemInterface,
		agencyId: number | undefined,
		agencyName: string | undefined,
		sessionKey: string | undefined,
		sessionParts: string,
		eligible = false
	) => {
		const consultant = raw.consultant as ConsultantLike | undefined;
		if (!consultant) return;
		upsertConsultant(
			{
				...consultant,
				consultantId: consultantIdOf(consultant) || UNKNOWN_AVATAR_SEED,
				avatar: {
					avatarKind: consultant.avatarKind,
					avatarId: consultant.avatarId
				}
			},
			agencyId,
			agencyName,
			sessionKey,
			sessionParts,
			eligible
		);
	};

	pairs.forEach(({ raw, extended }) => {
		const sessionKey = sessionSearchKeyOf(raw, extended);
		if (!sessionKey) {
			return;
		}
		const { agencyId, agencyName } = agencyOf(raw);
		const sessionParts = sessionPartsOf(raw, extended);

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
						readable(raw.user.displayName) ||
						readable(raw.user.username) ||
						labels.unknown,
					// UserService matches clients by username, not display name.
					lookupQuery: raw.user.username || undefined,
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
		upsertSessionConsultant(
			raw,
			agencyId,
			agencyName,
			sessionKey,
			sessionParts
		);
	});

	(options.eligibleCases ?? []).forEach((raw) => {
		const { agencyId, agencyName } = agencyOf(raw);
		upsertSessionConsultant(
			raw,
			agencyId,
			agencyName,
			undefined,
			sessionPartsOf(raw),
			true
		);
	});

	const takeoverOnly = options.eligibleCases !== undefined;
	return Array.from(byKey.values())
		.filter(
			(person) =>
				!takeoverOnly || person.role !== 'consultant' || person.eligible
		)
		.map(({ parts, ...person }) => ({
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
