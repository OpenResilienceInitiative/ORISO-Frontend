import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ChangePersonInput,
	ManagedPeopleSource,
	ManagedPerson,
	PersonCandidate,
	selectableCandidates
} from './managedPeople';

export type PeopleLoadState = 'loading' | 'ready' | 'error';
export type PeopleActionError = 'add' | 'remove' | 'replace';

/**
 * All state of the dialog: loading, the one change under way and what failed.
 * After every change both lists are read again, because the server decides who
 * is in, not this client.
 */
export const useManagedPeople = (
	source: ManagedPeopleSource,
	isOpen: boolean,
	locale?: string
) => {
	const [members, setMembers] = useState<ManagedPerson[]>([]);
	const [membersState, setMembersState] =
		useState<PeopleLoadState>('loading');
	const [candidates, setCandidates] = useState<PersonCandidate[]>([]);
	const [candidatesState, setCandidatesState] =
		useState<PeopleLoadState>('loading');
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<PeopleActionError | null>(
		null
	);
	const requestRef = useRef(0);

	const reload = useCallback(async () => {
		const request = ++requestRef.current;
		const isCurrent = () => request === requestRef.current;

		setMembersState('loading');
		setCandidatesState('loading');
		await Promise.all([
			source
				.loadMembers()
				.then((loaded) => {
					if (!isCurrent()) return;
					setMembers(loaded);
					setMembersState('ready');
				})
				.catch(() => {
					if (isCurrent()) setMembersState('error');
				}),
			(source.loadCandidates?.() ?? Promise.resolve([]))
				.then((loaded) => {
					if (!isCurrent()) return;
					setCandidates(loaded);
					setCandidatesState('ready');
				})
				.catch(() => {
					if (isCurrent()) setCandidatesState('error');
				})
		]);
	}, [source]);

	useEffect(() => {
		if (!isOpen) return;
		void reload();
		return () => {
			requestRef.current += 1;
		};
	}, [isOpen, reload]);

	const runChange = async (
		id: string,
		kind: PeopleActionError,
		change: () => Promise<void>
	): Promise<boolean> => {
		setPendingId(id);
		setActionError(null);
		try {
			await change();
			await reload();
			return true;
		} catch {
			setActionError(kind);
			return false;
		} finally {
			setPendingId(null);
		}
	};

	const addPerson = (candidate: PersonCandidate, input: ChangePersonInput) =>
		runChange(candidate.id, 'add', () =>
			source.addPerson
				? source.addPerson(candidate, input)
				: Promise.reject(new Error('add'))
		);

	const removePerson = (person: ManagedPerson) =>
		runChange(person.id, 'remove', () =>
			source.removePerson
				? source.removePerson(person)
				: Promise.reject(new Error('remove'))
		);

	const replacePerson = (
		person: ManagedPerson,
		candidate: PersonCandidate,
		input: ChangePersonInput
	) =>
		runChange(person.id, 'replace', () =>
			source.replacePerson
				? source.replacePerson(person, candidate, input)
				: Promise.reject(new Error('replace'))
		);

	const selectable = useMemo(
		() => selectableCandidates(candidates, members, locale),
		[candidates, members, locale]
	);

	return {
		members,
		membersState,
		candidates: selectable,
		candidatesState,
		pendingId,
		actionError,
		clearActionError: () => setActionError(null),
		reload,
		addPerson,
		removePerson,
		replacePerson
	};
};
