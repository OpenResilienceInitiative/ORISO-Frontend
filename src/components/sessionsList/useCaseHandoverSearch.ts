import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGetCaseHandoverCandidates } from '../../api';
import { apiGetAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import { FETCH_ERRORS } from '../../api/fetchData';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import {
	buildSearchPeopleResults,
	lookupTermsOf,
	personKeysOfSession,
	roleOfSearchWord,
	SessionSearchAgencyConsultant,
	SessionSearchPeopleLabels,
	SessionSearchPersonResult,
	SessionToolbarPair
} from './sessionSearchPeople';

const CANDIDATE_PAGE_SIZE = 50;
/** Upper bound for one person's lookup (20 x 50 cases). */
const CANDIDATE_MAX_PAGES = 20;
const SEARCH_DEBOUNCE_MS = 250;

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

/** Every candidate page for one query (FE#1725 US2: all of her cases). */
const fetchAllCandidates = async (query: string, archived: boolean) => {
	const found: ListItemInterface[] = [];
	for (let page = 0; page < CANDIDATE_MAX_PAGES; page++) {
		const { sessions = [], total } = await apiGetCaseHandoverCandidates({
			query,
			offset: page * CANDIDATE_PAGE_SIZE,
			count: CANDIDATE_PAGE_SIZE,
			archived
		});
		found.push(...sessions);
		const reachedTotal = typeof total === 'number' && total > 0;
		if (
			sessions.length < CANDIDATE_PAGE_SIZE ||
			(reachedTotal && found.length >= total)
		) {
			break;
		}
	}
	return found;
};

interface CaseHandoverSearchOptions {
	/** Counsellor toolbar with handover actions. */
	enabled: boolean;
	query: string;
	archived: boolean;
	/** Batch mode keeps what was found, so selected cases never vanish. */
	keepFound: boolean;
	agencies?: { id: number; name?: string }[];
}

/**
 * Case-handover search (FE#1725): text candidates, counsellors found by role
 * word, picked people and the cases pinned while they stay picked.
 */
export const useCaseHandoverSearch = ({
	enabled,
	query,
	archived,
	keepFound,
	agencies
}: CaseHandoverSearchOptions) => {
	const [textCandidates, setTextCandidates] = useState<ListItemInterface[]>(
		[]
	);
	/** Cases of picked people, by person key. */
	const [pinned, setPinned] = useState<Record<string, ListItemInterface[]>>(
		{}
	);
	const [pickedPeople, setPickedPeople] = useState<
		SessionSearchPersonResult[]
	>([]);
	/** Counsellors of my agencies, loaded on the first role-word search. */
	const [agencyConsultants, setAgencyConsultants] = useState<
		SessionSearchAgencyConsultant[] | null
	>(null);

	useEffect(() => {
		const trimmed = query.trim();
		if (!enabled) {
			setTextCandidates([]);
			return;
		}
		if (!trimmed) {
			if (!keepFound) setTextCandidates([]);
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
					setTextCandidates((prev) =>
						keepFound ? mergeListItems(sessions, prev) : sessions
					)
				)
				.catch((error) => {
					if (error?.message !== FETCH_ERRORS.ABORT && !keepFound) {
						setTextCandidates([]);
					}
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
			controller.abort();
		};
	}, [archived, enabled, keepFound, query]);

	// Role words list the counsellors of my agencies (FE#1725 US6).
	const namesConsultantRole = roleOfSearchWord(query) === 'consultant';
	useEffect(() => {
		if (!namesConsultantRole || !enabled || agencyConsultants !== null) {
			return;
		}
		let cancelled = false;
		Promise.all(
			(agencies ?? []).map((agency) =>
				apiGetAgencyConsultantList(String(agency.id))
					.catch(() => [])
					.then((consultants) =>
						(Array.isArray(consultants) ? consultants : []).map(
							(consultant) => ({
								...consultant,
								agencyId: agency.id,
								agencyName: agency.name
							})
						)
					)
			)
		).then((lists) => {
			if (!cancelled) setAgencyConsultants(lists.flat());
		});
		return () => {
			cancelled = true;
		};
	}, [agencies, agencyConsultants, enabled, namesConsultantRole]);

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
						textCandidates.filter((item) =>
							personKeysOfSession(item).includes(id)
						);
				});
				return next;
			});
			if (!enabled) return;
			added.forEach((id) => {
				const person = known.get(id);
				if (!person) return;
				Promise.all(
					lookupTermsOf(person).map((term) =>
						fetchAllCandidates(term, archived)
					)
				)
					.then((lists) =>
						setPinned((prev) =>
							Object.prototype.hasOwnProperty.call(prev, id)
								? {
										...prev,
										[id]: mergeListItems(
											prev[id],
											lists
												.flat()
												.filter((item) =>
													personKeysOfSession(
														item
													).includes(id)
												)
										)
									}
								: prev
						)
					)
					.catch(() => undefined);
			});
		},
		[archived, enabled, pickedPeople, textCandidates]
	);

	const reset = useCallback(() => {
		setPickedPeople([]);
		setPinned({});
	}, []);

	const candidateSessions = useMemo(
		() => mergeListItems(textCandidates, ...Object.values(pinned)),
		[pinned, textCandidates]
	);

	return {
		candidateSessions,
		agencyConsultants:
			namesConsultantRole && agencyConsultants ? agencyConsultants : [],
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
 * plus the counsellors of my agencies once a role word was typed.
 */
export const useSearchPeopleResults = (
	pairs: SessionToolbarPair[],
	labels: SessionSearchPeopleLabels,
	currentUser: { id: string; name?: string },
	agencyConsultants: SessionSearchAgencyConsultant[]
) =>
	useMemo(
		() =>
			buildSearchPeopleResults(pairs, labels, {
				currentUser,
				agencyConsultants
			}),
		// Labels and user are primitives in practice; key on their values.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			agencyConsultants,
			pairs,
			labels.asker,
			labels.consultant,
			labels.unknown,
			currentUser.id,
			currentUser.name
		]
	);
