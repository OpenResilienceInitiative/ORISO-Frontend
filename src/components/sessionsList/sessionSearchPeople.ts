/**
 * People results for the session search menu (#1195, JOB2 + JOB5).
 *
 * A session carries up to two people: the advice seeker (`raw.user`) and the
 * counsellor (`raw.consultant`). The previous builder collapsed them into one
 * row named after the client but subtitled with a hard-coded `Berater:in …`,
 * so every client was presented as a counsellor. Clients and counsellors are
 * separate roles, so each gets its own row with its own role label.
 *
 * Row ids stay prefixed with the session id (`<sessionId>:<role>`) because
 * `sessionMatchesToolbar` filters the session list by the selected row ids.
 */

import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

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
	id: string;
	name: string;
	subtitle: string;
	role: SessionSearchPersonRole;
	agencyId?: number;
	agencyName?: string;
	/** Stable per-person key for the generated animal avatar (JOB4). */
	avatarSeed: string;
}

export type SessionToolbarPair = {
	raw: ListItemInterface;
	extended: ExtendedSessionInterface;
};

/**
 * The id the toolbar has always used to tie a search row back to a session.
 * Shared with `sessionToolbarFilters` so both sides stay in step.
 */
export const sessionSearchKeyOf = (
	raw: ListItemInterface,
	extended?: Pick<ExtendedSessionInterface, 'item'>
): string =>
	String(raw.session?.id || raw.chat?.id || '') ||
	String(raw.chat?.matrixRoomId || '') ||
	String(extended?.item?.id || '');

/** `14055:asker` → `14055`. Row ids carry the role; the filter axis does not. */
export const sessionKeyFromPersonId = (personId: string): string =>
	personId.replace(/:(asker|consultant)$/, '');

const agencyOf = (raw: ListItemInterface) => ({
	agencyId: raw.agency?.id ?? raw.session?.agencyId,
	agencyName: raw.agency?.name
});

/**
 * Agency axis (JOB1). A counsellor who belongs to two agencies selects both and
 * sees both result sets, so this matches against a set rather than a single id.
 * An empty selection means "no agency filter", not "nothing matches".
 */
export const sessionMatchesAgencies = (
	raw: ListItemInterface,
	selectedAgencyIds: number[]
): boolean => {
	if (!selectedAgencyIds?.length) {
		return true;
	}
	const { agencyId } = agencyOf(raw);
	return agencyId !== undefined && selectedAgencyIds.includes(agencyId);
};

const subtitleOf = (
	roleLabel: string,
	agencyName: string | undefined,
	postcode: string | undefined
) =>
	[roleLabel, [agencyName, postcode].filter(Boolean).join(' ')]
		.filter(Boolean)
		.join(' | ');

/**
 * Narrows the people roster for the search menu (JOB7).
 *
 * Selecting a person used to collapse the list to just that person, because
 * toggling clears the query and the empty-query branch returned only the
 * selection — so a second person could never be picked. Selection state now
 * only drives the checkboxes; it never removes rows.
 */
export function filterSearchPeople<
	T extends { name: string; subtitle: string }
>(people: T[], query: string): T[] {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return people;
	}
	return people.filter((entry) =>
		`${entry.name} ${entry.subtitle}`.toLowerCase().includes(needle)
	);
}

export function buildSearchPeopleResults(
	pairs: SessionToolbarPair[],
	labels: SessionSearchPeopleLabels
): SessionSearchPersonResult[] {
	const seen = new Set<string>();
	const results: SessionSearchPersonResult[] = [];

	pairs.forEach(({ raw, extended }) => {
		const sessionKey = sessionSearchKeyOf(raw, extended);
		if (!sessionKey) {
			return;
		}
		const { agencyId, agencyName } = agencyOf(raw);
		const postcode = raw.session?.postcode
			? String(raw.session.postcode)
			: undefined;

		const push = (
			role: SessionSearchPersonRole,
			name: string | undefined,
			seed: string | undefined
		) => {
			if (!name) {
				return;
			}
			const id = `${sessionKey}:${role}`;
			if (seen.has(id)) {
				return;
			}
			seen.add(id);
			results.push({
				id,
				name,
				subtitle: subtitleOf(labels[role], agencyName, postcode),
				role,
				agencyId,
				agencyName,
				avatarSeed: seed || id
			});
		};

		// A role the session does not carry produces no row at all; a person who
		// is present but nameless keeps a row under the "unknown" label, which
		// is what the previous builder did.
		push(
			'asker',
			raw.user &&
				(raw.user.displayName || raw.user.username || labels.unknown),
			raw.session?.askerMatrixUserId ||
				raw.user?.username ||
				UNKNOWN_AVATAR_SEED
		);
		push(
			'consultant',
			raw.consultant &&
				(raw.consultant.displayName ||
					raw.consultant.username ||
					labels.unknown),
			raw.consultant?.consultantId ||
				raw.consultant?.username ||
				UNKNOWN_AVATAR_SEED
		);
	});

	return results;
}
