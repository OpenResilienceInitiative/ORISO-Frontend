/**
 * Pure helpers behind the composer's "Send to" (audience) selector.
 *
 * They used to live inline in `messageSubmitInterfaceComponent.tsx`, where a
 * 200-line `useEffect` both derived the options and reconciled the selection.
 * Nothing about that was reachable from a test, which is how the restore bug
 * below survived: the effect read `localStorage` only when no "all" option
 * existed, while the selector itself renders only when "all" *does* exist. The
 * saved selection was therefore written on every change and never read back.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#894 (rule D).
 */

/** Sentinel option value meaning "everyone in this conversation". */
export const AUDIENCE_ALL = '__all__';

/**
 * What a recipient *is*, decided while the options are built rather than
 * guessed afterwards from the label text. The old icon picker searched the
 * rendered label for the substrings "moderator", "supervisor" and "berater",
 * so a generated pseudonym could pick the wrong symbol and a counsellor whose
 * display name contained none of those words always got the client icon.
 */
export type AudienceKind =
	| 'all'
	| 'asker'
	| 'consultant'
	| 'supervisor'
	| 'person';

export interface AudienceOption {
	value: string;
	label: string;
	kind: AudienceKind;
}

/**
 * The selection to use when nothing valid was restored: "all" when the
 * conversation offers it, otherwise the first concrete recipient.
 */
export const defaultAudienceSelection = (
	options: AudienceOption[]
): string[] => {
	if (options.some((option) => option.value === AUDIENCE_ALL)) {
		return [AUDIENCE_ALL];
	}
	return options[0]?.value ? [options[0].value] : [AUDIENCE_ALL];
};

/**
 * Read a previously stored selection back.
 *
 * Returns `null` — rather than a default — whenever there is nothing usable,
 * so the caller can tell "the user had no saved choice" apart from "the user
 * deliberately chose everyone". Values whose participant has since left the
 * conversation are dropped instead of invalidating the whole selection.
 */
export const restoreAudienceSelection = (
	rawSaved: string | null | undefined,
	options: AudienceOption[]
): string[] | null => {
	if (!rawSaved) {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawSaved);
	} catch (_error) {
		return null;
	}
	if (!Array.isArray(parsed)) {
		return null;
	}
	const available = new Set(options.map((option) => option.value));
	const valid = parsed.filter(
		(value): value is string =>
			typeof value === 'string' && available.has(value)
	);
	return valid.length > 0 ? valid : null;
};

/**
 * The identifiers of everyone whose role we actually know, grouped by role.
 *
 * Built with the strict normaliser below rather than the composer's fuzzy
 * `getComparableAudienceIds`, which splits an id into tokens of four or more
 * characters — so every participant on the same homeserver shares the token
 * `oriso`, far too loose to decide whether somebody is a moderator.
 *
 * Recipient collection (`createAudienceCollector`) is strict for the same
 * reason; the fuzzy matcher now survives only in the @-mention provider.
 */
export interface AudienceRoster {
	asker: Set<string>;
	consultant: Set<string>;
	supervisor: Set<string>;
}

/**
 * Strict identity keys for one raw value: the value itself, the same without a
 * leading `@`, and the Matrix local part before `:`. Askers appear both as
 * `@enc.<username>:<server>` and as a bare `<username>`, so a leading `enc.`
 * is stripped as well — otherwise the same person fails to match themselves.
 */
export const audienceIdentityKeys = (rawValue?: string | null): Set<string> => {
	const keys = new Set<string>();
	const compact = `${rawValue || ''}`.trim().toLowerCase();
	if (!compact) {
		return keys;
	}
	const add = (value: string) => {
		const normalized = value.trim();
		if (!normalized) {
			return;
		}
		keys.add(normalized);
		if (normalized.startsWith('enc.')) {
			keys.add(normalized.slice(4));
		}
	};
	add(compact);
	const withoutAt = compact.startsWith('@') ? compact.slice(1) : compact;
	add(withoutAt);
	add(withoutAt.split(':')[0]);
	return keys;
};

const collectKeys = (values: (string | null | undefined)[]): Set<string> => {
	const keys = new Set<string>();
	values.forEach((value) =>
		audienceIdentityKeys(value).forEach((key) => keys.add(key))
	);
	return keys;
};

/**
 * A lookup keyed by identity rather than by one spelling of an id.
 *
 * The same person reaches the composer as `@enc.katze_mika:oriso.org` from the
 * room member list, as `katze_mika` from the session payload and as a bare
 * consultant id from the supervisor endpoint. Registering every key once means
 * a later lookup finds them whichever spelling it happens to hold.
 *
 * First writer wins, so the caller's own precedence (mapped display name over
 * username over raw id) survives.
 */
export const createIdentityLookup = <T>() => {
	const byKey = new Map<string, T>();
	return {
		set: (rawValues: (string | null | undefined)[], value: T): void => {
			rawValues.forEach((rawValue) =>
				audienceIdentityKeys(rawValue).forEach((key) => {
					if (!byKey.has(key)) {
						byKey.set(key, value);
					}
				})
			);
		},
		get: (rawValue?: string | null): T | undefined =>
			Array.from(audienceIdentityKeys(rawValue))
				.map((key) => byKey.get(key))
				.find((entry) => entry !== undefined),
		get size(): number {
			return byKey.size;
		}
	};
};

export interface AudienceCollector {
	/** Whether this id is the viewer themselves. */
	isSelf: (rawValue?: string | null) => boolean;
	/** Whether this id is somebody already collected. */
	has: (rawValue?: string | null) => boolean;
	/**
	 * Record a recipient unless they are the viewer or already present.
	 * Returns whether the entry was actually taken.
	 */
	add: (rawValue: string | null | undefined, label: string) => boolean;
	/** The collected recipients as `[value, label]`, in insertion order. */
	entries: () => [string, string][];
}

/**
 * Gathers the conversation's recipients, keeping the two decisions that can
 * silently drop somebody — "is this me?" and "do I already have this
 * person?" — on strict identity.
 *
 * Both used to run through the composer's fuzzy `getComparableAudienceIds`,
 * which adds every token of four or more characters to the comparison set. For
 * a Matrix id that includes the homeserver, so *every* participant on
 * `oriso.org` shares the token `oriso`:
 *
 * - as a self test, the first member of the room list matched the signed-in
 *   user and the entire room was discarded as "me";
 * - as a duplicate test, the second recipient matched the first and was
 *   discarded as "already collected".
 *
 * Either way the recipient list came out wrong, and a message narrowed to one
 * person could reach somebody who was never offered as a target. Strict keys
 * (exact value, without the leading `@`, Matrix local part, `enc.` stripped)
 * still recognise one person across their several spellings without ever
 * conflating two people who merely share a homeserver.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#894.
 */
export const createAudienceCollector = (
	selfIdentifiers: (string | null | undefined)[] = []
): AudienceCollector => {
	const selfKeys = collectKeys(selfIdentifiers);
	const labelByValue = new Map<string, string>();
	const keysByValue = new Map<string, Set<string>>();

	const isSelf = (rawValue?: string | null): boolean =>
		Array.from(audienceIdentityKeys(rawValue)).some((key) =>
			selfKeys.has(key)
		);

	const has = (rawValue?: string | null): boolean => {
		const keys = Array.from(audienceIdentityKeys(rawValue));
		if (keys.length === 0) {
			return false;
		}
		return Array.from(keysByValue.values()).some((existing) =>
			keys.some((key) => existing.has(key))
		);
	};

	const add = (
		rawValue: string | null | undefined,
		label: string
	): boolean => {
		const compact = `${rawValue || ''}`.trim();
		if (!compact || isSelf(compact) || has(compact)) {
			return false;
		}
		labelByValue.set(compact, label);
		keysByValue.set(compact, audienceIdentityKeys(compact));
		return true;
	};

	return {
		isSelf,
		has,
		add,
		entries: () => Array.from(labelByValue.entries())
	};
};

export const buildAudienceRoster = ({
	askerIds = [],
	consultantIds = [],
	supervisorIds = []
}: {
	askerIds?: (string | null | undefined)[];
	consultantIds?: (string | null | undefined)[];
	supervisorIds?: (string | null | undefined)[];
}): AudienceRoster => ({
	asker: collectKeys(askerIds),
	consultant: collectKeys(consultantIds),
	supervisor: collectKeys(supervisorIds)
});

/**
 * Decide what a recipient is. Supervision wins over the counselling role: a
 * consultant who is also supervising this conversation is a moderator here,
 * and the icon has to say the more restrictive thing.
 */
export const classifyAudienceKind = (
	value: string,
	roster: AudienceRoster
): AudienceKind => {
	if (value === AUDIENCE_ALL) {
		return 'all';
	}
	const keys = Array.from(audienceIdentityKeys(value));
	if (keys.some((key) => roster.supervisor.has(key))) {
		return 'supervisor';
	}
	if (keys.some((key) => roster.asker.has(key))) {
		return 'asker';
	}
	if (keys.some((key) => roster.consultant.has(key))) {
		return 'consultant';
	}
	return 'person';
};

/**
 * Keep as much of the current selection as the rebuilt options still allow.
 *
 * Called whenever the option list is derived again — which happens on a timer
 * shortly after mount and whenever a Matrix member or supervisor arrives. The
 * previous implementation reset to "everyone" on every one of those rebuilds,
 * discarding a recipient the user had just picked.
 */
export const reconcileAudienceSelection = (
	currentValues: string[],
	options: AudienceOption[]
): string[] => {
	const available = new Set(options.map((option) => option.value));
	const stillAvailable = currentValues.filter((value) =>
		available.has(value)
	);
	if (stillAvailable.length > 0) {
		return stillAvailable;
	}
	return defaultAudienceSelection(options);
};

/**
 * Whether the "Send to" control is shown at all.
 *
 * - Rule A: a 1-1 conversation has exactly one possible recipient, so there is
 *   nothing to choose and the control disappears rather than sitting there
 *   inert.
 * - Rule E: advice seekers never see it. Note what that costs — from the
 *   composer alone they cannot tell who will read what they write — so the
 *   disclosure has to come from the message itself instead. Recorded on #894.
 * - It also needs the "everyone" option to exist, otherwise there is no way
 *   back from a narrowed audience.
 */
export const shouldShowAudienceSelector = ({
	isClientUser,
	options
}: {
	isClientUser: boolean;
	options: AudienceOption[];
}): boolean => {
	if (isClientUser) {
		return false;
	}
	const targetCount = options.filter(
		(option) => option.value !== AUDIENCE_ALL
	).length;
	if (targetCount <= 1) {
		return false;
	}
	return options.some((option) => option.value === AUDIENCE_ALL);
};

/**
 * Whether the option list is real yet, as opposed to the placeholder the
 * component starts with.
 *
 * `audienceOptions` is seeded with a lone `__all__` entry and only gains the
 * actual recipients once the Matrix room members have loaded. Anything that
 * reads a stored selection has to wait for that: matching saved recipients
 * against the placeholder finds nothing, and a restore that has already run
 * will not run again when the real list arrives.
 */
export const audienceOptionsReady = (options: AudienceOption[]): boolean =>
	options.some((option) => option.value !== AUDIENCE_ALL);

export interface GroupedAudienceOption extends AudienceOption {
	/** The viewer's own entry: shown, but not selectable. */
	disabled: boolean;
}

export interface GroupedAudienceOptions {
	clients: GroupedAudienceOption[];
	counsellors: GroupedAudienceOption[];
	moderators: GroupedAudienceOption[];
}

/**
 * Split the recipients into the three menu sections, using the role decided
 * when the option was built.
 *
 * The menu used to re-derive roles with `getComparableAudienceIds`, whose
 * four-character-plus tokens include the homeserver name — every participant
 * on `oriso.org` shares the token `oriso`, so a single supervisor in the room
 * could pull unrelated people into the moderator section, and the section
 * decides which icon their pill gets. Reported by CodeRabbit on #948.
 *
 * `person` — somebody in the room whose role we could not establish — joins the
 * counsellors, which is where the previous implementation put them and the
 * safer of the two: it does not imply supervision that may not exist, and it
 * does not label a staff member as a client.
 */
export const groupAudienceOptions = (
	options: AudienceOption[],
	selfIdentifiers: (string | null | undefined)[]
): GroupedAudienceOptions => {
	const selfKeys = collectKeys(selfIdentifiers);
	const grouped: GroupedAudienceOptions = {
		clients: [],
		counsellors: [],
		moderators: []
	};
	options.forEach((option) => {
		if (option.value === AUDIENCE_ALL) {
			return;
		}
		// Exact match, not the fuzzy one: two generated display names can share
		// a word ("Alpaka"), and disabling the wrong row hides a real recipient.
		const disabled = Array.from(audienceIdentityKeys(option.value)).some(
			(key) => selfKeys.has(key)
		);
		const entry = { ...option, disabled };
		if (option.kind === 'supervisor') {
			grouped.moderators.push(entry);
			return;
		}
		if (option.kind === 'asker') {
			grouped.clients.push(entry);
			return;
		}
		grouped.counsellors.push(entry);
	});
	return grouped;
};
