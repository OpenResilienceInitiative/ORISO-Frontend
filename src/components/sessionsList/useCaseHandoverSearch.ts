import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	apiGetCaseHandoverCandidates,
	apiGetConsultantSessionList
} from '../../api';
import { useCaseHandoverRowStatuses } from './caseHandoverRowStatuses';
import { FETCH_ERRORS } from '../../api/fetchData';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import {
	buildSearchPeopleResults,
	lookupTermsOf,
	personKeysOfSession,
	SessionSearchPeopleLabels,
	SessionSearchPersonResult,
	SessionToolbarPair
} from './sessionSearchPeople';
import {
	SESSION_LIST_TAB_ARCHIVE,
	SESSION_LIST_TYPES
} from '../session/sessionHelpers';

const CANDIDATE_PAGE_SIZE = 50;
/** Upper bound for the blank roster load (20 x 50 cases). */
const CANDIDATE_MAX_PAGES = 20;
const SEARCH_DEBOUNCE_MS = 250;
const NO_CASES: ListItemInterface[] = [];

const listItemIdOf = (item: ListItemInterface) =>
	item.session?.id !== undefined
		? `session:${item.session.id}`
		: item.chat?.id !== undefined
			? `chat:${item.chat.id}`
			: null;

/** Concatenates list items; the first occurrence of an id wins. */
export const mergeListItems = (...lists: ListItemInterface[][]) => {
	const seen = new Set<string>();
	const merged: ListItemInterface[] = [];
	lists.forEach((list) =>
		list.forEach((item) => {
			const id = listItemIdOf(item);
			if (id !== null) {
				if (seen.has(id)) return;
				seen.add(id);
			}
			merged.push(item);
		})
	);
	return merged;
};

type CasePage<T extends ListItemInterface> = { sessions?: T[]; total?: number };

/**
 * Pages a case list from offset 0 until the reported total, an empty page
 * or (without a total) a short page. `capped` is set when `maxPages`
 * stopped it while more cases may exist.
 */
const pageThrough = async <T extends ListItemInterface>(
	fetchPage: (offset: number, count: number) => Promise<CasePage<T>>,
	maxPages = Number.POSITIVE_INFINITY
) => {
	const found: T[] = [];
	for (let page = 0; page < maxPages; page++) {
		const { sessions = [], total } = await fetchPage(
			found.length,
			CANDIDATE_PAGE_SIZE
		);
		found.push(...sessions);
		const done =
			typeof total === 'number' && total > 0
				? found.length >= total
				: sessions.length < CANDIDATE_PAGE_SIZE;
		if (!sessions.length || done) return { cases: found, capped: false };
	}
	return { cases: found, capped: true };
};

/**
 * Candidate pages for one query. Only the blank roster passes a page cap
 * (FE#1725 US2: a picked person's lookup always runs to the end).
 */
const fetchAllCandidates = (
	query: string,
	archived: boolean,
	signal?: AbortSignal,
	maxPages?: number
) =>
	pageThrough(
		(offset, count) =>
			apiGetCaseHandoverCandidates({
				query,
				offset,
				count,
				archived,
				signal
			}),
		maxPages
	);

/**
 * The cases of one person in my own list, paged to the end: the list has no
 * server-side person filter, and the candidate endpoint leaves out my own
 * cases.
 */
const fetchOwnListCases = async (
	personId: string,
	archived: boolean,
	signal?: AbortSignal
) => {
	const { cases } = await pageThrough((offset, count) =>
		apiGetConsultantSessionList({
			type: SESSION_LIST_TYPES.MY_SESSION,
			offset,
			count,
			sessionListTab: archived ? SESSION_LIST_TAB_ARCHIVE : undefined,
			signal
		}).catch((error) => {
			// 204: nothing (more) in the list.
			if ((error as Error)?.message === FETCH_ERRORS.EMPTY) {
				return { sessions: [] };
			}
			throw error;
		})
	);
	return cases.filter((item) => personKeysOfSession(item).includes(personId));
};

/**
 * All cases of one person in one archive scope: her takeable cases by her
 * lookup terms, and for a client also her cases in my own list.
 */
const fetchPersonCases = async (
	person: SessionSearchPersonResult,
	archived: boolean,
	signal?: AbortSignal
) => {
	const [candidateLists, ownCases] = await Promise.all([
		Promise.all(
			lookupTermsOf(person).map(async (term) =>
				(await fetchAllCandidates(term, archived, signal)).cases.filter(
					(item) => personKeysOfSession(item).includes(person.id)
				)
			)
		),
		person.role === 'asker'
			? fetchOwnListCases(person.id, archived, signal)
			: []
	]);
	return {
		candidates: candidateLists.flat(),
		cases: mergeListItems(...candidateLists, ownCases)
	};
};

interface CaseHandoverSearchOptions {
	actorId: string;
	/** Counsellor toolbar with handover actions. */
	enabled: boolean;
	query: string;
	archived: boolean;
	/** Batch mode keeps what was found, so selected cases never vanish. */
	keepFound: boolean;
	/** The search menu is open: the eligible colleagues are loaded for it. */
	searchOpen: boolean;
}

/** Loading state of the eligible colleagues (FE#1152). */
export type EligibleColleaguesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Case-handover search (FE#1725, FE#1152): text candidates, the eligible
 * colleagues, picked people and the cases pinned while they stay picked.
 *
 * The eligible colleagues are the counsellors of the cases the signed-in
 * counsellor may take over (UserService answers a blank query with all of
 * them). They are loaded once when the search menu opens and are the only
 * colleagues the menu offers, also for role words.
 */
export const useCaseHandoverSearch = ({
	actorId,
	enabled,
	query,
	archived,
	keepFound,
	searchOpen
}: CaseHandoverSearchOptions) => {
	const { startRead, invalidate, getRowStatus } = useCaseHandoverRowStatuses(
		actorId,
		archived,
		enabled
	);
	/** Text-query results, tagged with the archive scope they belong to. */
	const [textResult, setTextResult] = useState<{
		actorId: string;
		archived: boolean;
		cases: ListItemInterface[];
	}>({ actorId, archived, cases: NO_CASES });
	// Batch mode keeps found cases, but never across the archive scope.
	const textCandidates =
		textResult.actorId === actorId && textResult.archived === archived
			? textResult.cases
			: NO_CASES;
	/** Cases of picked people, by person key. */
	const [pinned, setPinned] = useState<Record<string, ListItemInterface[]>>(
		{}
	);
	const [pickedPeople, setPickedPeople] = useState<
		SessionSearchPersonResult[]
	>([]);
	/** Cases I may take over; only their counsellors are listed (FE#1152). */
	const [eligible, setEligible] = useState<{
		actorId: string;
		archived: boolean;
		cases: ListItemInterface[];
		/** The page limit stopped the load; more cases may exist. */
		capped: boolean;
		status: EligibleColleaguesStatus;
	} | null>(null);
	// What was loaded for the other archive tab does not count.
	const eligibleNow =
		eligible &&
		eligible.actorId === actorId &&
		eligible.archived === archived
			? eligible
			: null;
	const eligibleCases = eligibleNow?.cases ?? NO_CASES;
	const eligibleStatus = eligibleNow?.status ?? 'idle';
	const eligibleCapped = eligibleNow?.capped ?? false;

	useEffect(() => {
		const trimmed = query.trim();
		if (!enabled) {
			setTextResult({ actorId, archived, cases: NO_CASES });
			return;
		}
		if (!trimmed) {
			if (!keepFound)
				setTextResult({ actorId, archived, cases: NO_CASES });
			return;
		}
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => {
			const remember = startRead();
			apiGetCaseHandoverCandidates({
				query: trimmed,
				count: CANDIDATE_PAGE_SIZE,
				archived,
				signal: controller.signal
			})
				.then(({ sessions = [] }) => {
					if (controller.signal.aborted) return;
					remember(sessions);
					setTextResult((prev) => ({
						actorId,
						archived,
						cases:
							keepFound &&
							prev.actorId === actorId &&
							prev.archived === archived
								? mergeListItems(sessions, prev.cases)
								: sessions
					}));
				})
				.catch((error) => {
					if (error?.message !== FETCH_ERRORS.ABORT && !keepFound) {
						setTextResult({ actorId, archived, cases: NO_CASES });
					}
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
			controller.abort();
		};
	}, [actorId, archived, enabled, keepFound, query, startRead]);

	useEffect(() => {
		if (!enabled) {
			setEligible(null);
			return;
		}
		if (!searchOpen) return;
		let cancelled = false;
		const controller = new AbortController();
		setEligible((prev) =>
			prev &&
			prev.actorId === actorId &&
			prev.archived === archived &&
			prev.status !== 'error'
				? prev
				: {
						actorId,
						archived,
						cases: [],
						capped: false,
						status: 'loading'
					}
		);
		const remember = startRead();
		fetchAllCandidates('', archived, controller.signal, CANDIDATE_MAX_PAGES)
			.then(({ cases, capped }) => {
				if (cancelled) return;
				remember(cases);
				setEligible({
					actorId,
					archived,
					cases,
					capped,
					status: 'ready'
				});
			})
			.catch(() => {
				if (!cancelled)
					setEligible({
						actorId,
						archived,
						cases: [],
						capped: false,
						status: 'error'
					});
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [actorId, archived, enabled, searchOpen, startRead]);

	/**
	 * Per-person case loads of the current archive scope. Switching the
	 * scope, the X (reset) and unmounting abort them, so a late answer for
	 * the old scope never reaches the pins. Closing with the red check keeps
	 * the picked people and lets their loads finish (US5).
	 */
	const personLoadsRef = useRef<AbortController | null>(null);
	const personLoadSignal = useCallback(() => {
		personLoadsRef.current ??= new AbortController();
		return personLoadsRef.current.signal;
	}, []);
	const abortPersonLoads = useCallback(() => {
		personLoadsRef.current?.abort();
		personLoadsRef.current = null;
	}, []);
	useEffect(() => abortPersonLoads, [abortPersonLoads]);

	/** Loads a person's cases into her pin while she stays picked. */
	const loadPersonCases = useCallback(
		(person: SessionSearchPersonResult, scope: boolean) => {
			const signal = personLoadSignal();
			const remember = startRead();
			fetchPersonCases(person, scope, signal)
				.then(({ candidates, cases }) => {
					if (signal.aborted) return;
					remember(candidates);
					setPinned((prev) =>
						Object.prototype.hasOwnProperty.call(prev, person.id)
							? {
									...prev,
									[person.id]: mergeListItems(
										prev[person.id],
										cases
									)
								}
							: prev
					);
				})
				.catch(() => undefined);
		},
		[personLoadSignal, startRead]
	);

	/**
	 * "Archive only" changes the scope: the picked people stay picked, but
	 * their cases are reloaded for it instead of carrying the old ones over.
	 */
	const pickedRef = useRef(pickedPeople);
	pickedRef.current = pickedPeople;
	const scopeRef = useRef({ actorId, archived });
	useEffect(() => {
		if (scopeRef.current.actorId !== actorId) {
			scopeRef.current = { actorId, archived };
			abortPersonLoads();
			setPickedPeople([]);
			setPinned({});
			return;
		}
		if (scopeRef.current.archived === archived) return;
		scopeRef.current = { actorId, archived };
		abortPersonLoads();
		const people = pickedRef.current;
		setPinned(Object.fromEntries(people.map((person) => [person.id, []])));
		if (!enabled) return;
		people.forEach((person) => loadPersonCases(person, archived));
	}, [abortPersonLoads, actorId, archived, enabled, loadPersonCases]);

	/**
	 * Picking keeps the text (US3) and loads all of each new person's cases,
	 * whatever is already listed (US2); they stay while she is picked.
	 */
	const selectPeople = useCallback(
		(ids: string[], people: SessionSearchPersonResult[]) => {
			const known = new Map(
				[...pickedPeople, ...people].map((person) => [
					person.id,
					person
				])
			);
			const added = ids.filter(
				(id) => !pickedPeople.some((person) => person.id === id)
			);
			setPickedPeople(
				ids
					.map((id) => known.get(id))
					.filter((person): person is SessionSearchPersonResult =>
						Boolean(person)
					)
			);
			setPinned((prev) => {
				const next: Record<string, ListItemInterface[]> = {};
				ids.forEach((id) => {
					next[id] =
						prev[id] ??
						mergeListItems(textCandidates, eligibleCases).filter(
							(item) => personKeysOfSession(item).includes(id)
						);
				});
				return next;
			});
			if (!enabled) return;
			added.forEach((id) => {
				const person = known.get(id);
				if (person) loadPersonCases(person, archived);
			});
		},
		[
			archived,
			eligibleCases,
			enabled,
			loadPersonCases,
			pickedPeople,
			textCandidates
		]
	);

	/**
	 * The search's X. Batch mode keeps found cases, but an explicit reset
	 * drops the unselected ones, so only the cases selected for the batch
	 * stay next to the normal list.
	 */
	const reset = useCallback(
		(keepSessionIds: number[] = []) => {
			abortPersonLoads();
			invalidate();
			const keep = new Set(keepSessionIds.map(String));
			setTextResult((prev) => ({
				actorId: prev.actorId,
				archived: prev.archived,
				cases: mergeListItems(
					prev.cases,
					...Object.values(pinned)
				).filter(
					(item) =>
						item.session?.id !== undefined &&
						keep.has(String(item.session.id))
				)
			}));
			setPickedPeople([]);
			setPinned({});
		},
		[abortPersonLoads, invalidate, pinned]
	);

	const candidateSessions = useMemo(
		() =>
			mergeListItems(
				textCandidates,
				...(scopeRef.current.actorId === actorId &&
				scopeRef.current.archived === archived
					? Object.values(pinned)
					: [])
			),
		[actorId, archived, pinned, textCandidates]
	);
	/**
	 * Cases I may take over: the blank roster plus what a typed query found
	 * on the same endpoint, so a colleague beyond the roster's page cap is
	 * offered once her name is typed.
	 */
	const takeableCases = useMemo(
		() =>
			textCandidates.length
				? mergeListItems(eligibleCases, textCandidates)
				: eligibleCases,
		[eligibleCases, textCandidates]
	);

	const candidateIds = useMemo(
		() => new Set(candidateSessions.map((item) => item.session?.id)),
		[candidateSessions]
	);
	const getCaseHandoverRowStatus = useCallback(
		(id: number) => getRowStatus(id, candidateIds.has(id)),
		[candidateIds, getRowStatus]
	);

	return {
		candidateSessions,
		getRowStatus: getCaseHandoverRowStatus,
		invalidateRowStatuses: invalidate,
		eligibleCases,
		takeableCases,
		eligibleStatus,
		eligibleCapped,
		selectedPersonIds: useMemo(
			() => pickedPeople.map((person) => person.id),
			[pickedPeople]
		),
		pickedPeople,
		selectPeople,
		reset
	};
};

/**
 * People, not case rows (FE#1725 US1): one row per role + user + agency,
 * plus the eligible colleagues (FE#1152).
 */
export const useSearchPeopleResults = (
	pairs: SessionToolbarPair[],
	labels: SessionSearchPeopleLabels,
	currentUser: { id: string; name?: string },
	/** Handover search only; without it every counsellor stays a row. */
	eligibleCases: ListItemInterface[] | undefined,
	/** Staff only: show and match counsellors' internal names. */
	internalNames = false
) =>
	useMemo(
		() =>
			buildSearchPeopleResults(pairs, labels, {
				currentUser,
				eligibleCases,
				internalNames
			}),
		// Labels and user are primitives in practice; key on their values.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			eligibleCases,
			internalNames,
			pairs,
			labels.asker,
			labels.consultant,
			labels.unknown,
			currentUser.id,
			currentUser.name
		]
	);
