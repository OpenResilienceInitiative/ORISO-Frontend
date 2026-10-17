import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGetCaseHandoverCandidates } from '../../api';
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

const CANDIDATE_PAGE_SIZE = 50;
/** Upper bound for one person's lookup (20 x 50 cases). */
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

/**
 * Every candidate page for one query (FE#1725 US2: all of her cases).
 * `capped` is set when the page limit stopped the load while more cases
 * may exist.
 */
const fetchAllCandidates = async (
	query: string,
	archived: boolean,
	signal?: AbortSignal
) => {
	const found: ListItemInterface[] = [];
	for (let page = 0; page < CANDIDATE_MAX_PAGES; page++) {
		const { sessions = [], total } = await apiGetCaseHandoverCandidates({
			query,
			offset: page * CANDIDATE_PAGE_SIZE,
			count: CANDIDATE_PAGE_SIZE,
			archived,
			signal
		});
		found.push(...sessions);
		const reachedTotal = typeof total === 'number' && total > 0;
		if (
			sessions.length < CANDIDATE_PAGE_SIZE ||
			(reachedTotal && found.length >= total)
		) {
			return { cases: found, capped: false };
		}
	}
	return { cases: found, capped: true };
};

/** All cases of one person in one archive scope, by her lookup terms. */
const fetchPersonCases = async (
	person: SessionSearchPersonResult,
	archived: boolean,
	signal?: AbortSignal
) => {
	const lists = await Promise.all(
		lookupTermsOf(person).map(
			async (term) =>
				(await fetchAllCandidates(term, archived, signal)).cases
		)
	);
	return lists
		.flat()
		.filter((item) => personKeysOfSession(item).includes(person.id));
};

interface CaseHandoverSearchOptions {
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
	enabled,
	query,
	archived,
	keepFound,
	searchOpen
}: CaseHandoverSearchOptions) => {
	/** Text-query results, tagged with the archive scope they belong to. */
	const [textResult, setTextResult] = useState<{
		archived: boolean;
		cases: ListItemInterface[];
	}>({ archived, cases: NO_CASES });
	// Batch mode keeps found cases, but never across the archive scope.
	const textCandidates =
		textResult.archived === archived ? textResult.cases : NO_CASES;
	/** Cases of picked people, by person key. */
	const [pinned, setPinned] = useState<Record<string, ListItemInterface[]>>(
		{}
	);
	const [pickedPeople, setPickedPeople] = useState<
		SessionSearchPersonResult[]
	>([]);
	/** Cases I may take over; only their counsellors are listed (FE#1152). */
	const [eligible, setEligible] = useState<{
		archived: boolean;
		cases: ListItemInterface[];
		/** The page limit stopped the load; more cases may exist. */
		capped: boolean;
		status: EligibleColleaguesStatus;
	} | null>(null);
	// What was loaded for the other archive tab does not count.
	const eligibleNow = eligible?.archived === archived ? eligible : null;
	const eligibleCases = eligibleNow?.cases ?? NO_CASES;
	const eligibleStatus = eligibleNow?.status ?? 'idle';
	const eligibleCapped = eligibleNow?.capped ?? false;

	useEffect(() => {
		const trimmed = query.trim();
		if (!enabled) {
			setTextResult({ archived, cases: NO_CASES });
			return;
		}
		if (!trimmed) {
			if (!keepFound) setTextResult({ archived, cases: NO_CASES });
			return;
		}
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => {
			apiGetCaseHandoverCandidates({
				query: trimmed,
				count: CANDIDATE_PAGE_SIZE,
				archived,
				signal: controller.signal
			})
				.then(({ sessions = [] }) =>
					setTextResult((prev) => ({
						archived,
						cases:
							keepFound && prev.archived === archived
								? mergeListItems(sessions, prev.cases)
								: sessions
					}))
				)
				.catch((error) => {
					if (error?.message !== FETCH_ERRORS.ABORT && !keepFound) {
						setTextResult({ archived, cases: NO_CASES });
					}
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
			controller.abort();
		};
	}, [archived, enabled, keepFound, query]);

	useEffect(() => {
		if (!enabled) {
			setEligible(null);
			return;
		}
		if (!searchOpen) return;
		let cancelled = false;
		const controller = new AbortController();
		setEligible((prev) =>
			prev?.archived === archived && prev.status !== 'error'
				? prev
				: { archived, cases: [], capped: false, status: 'loading' }
		);
		fetchAllCandidates('', archived, controller.signal)
			.then(({ cases, capped }) => {
				if (!cancelled)
					setEligible({ archived, cases, capped, status: 'ready' });
			})
			.catch(() => {
				if (!cancelled)
					setEligible({
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
	}, [archived, enabled, searchOpen]);

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
			fetchPersonCases(person, scope, signal)
				.then((cases) => {
					if (signal.aborted) return;
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
		[personLoadSignal]
	);

	/**
	 * "Archive only" changes the scope: the picked people stay picked, but
	 * their cases are reloaded for it instead of carrying the old ones over.
	 */
	const pickedRef = useRef(pickedPeople);
	pickedRef.current = pickedPeople;
	const scopeRef = useRef(archived);
	useEffect(() => {
		if (scopeRef.current === archived) return;
		scopeRef.current = archived;
		abortPersonLoads();
		const people = pickedRef.current;
		setPinned(Object.fromEntries(people.map((person) => [person.id, []])));
		if (!enabled) return;
		people.forEach((person) => loadPersonCases(person, archived));
	}, [abortPersonLoads, archived, enabled, loadPersonCases]);

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

	const reset = useCallback(() => {
		abortPersonLoads();
		setPickedPeople([]);
		setPinned({});
	}, [abortPersonLoads]);

	const candidateSessions = useMemo(
		() => mergeListItems(textCandidates, ...Object.values(pinned)),
		[pinned, textCandidates]
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

	return {
		candidateSessions,
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
