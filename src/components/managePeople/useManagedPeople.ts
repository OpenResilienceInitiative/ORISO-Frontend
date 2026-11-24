import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ChangePersonInput,
	ManagedPeopleSource,
	ManagedPerson,
	PersonCandidate,
	PersonChangeRefusedError,
	selectableCandidates
} from './managedPeople';

export type PeopleLoadState = 'loading' | 'ready' | 'error';
export type PeopleActionKind = 'add' | 'remove' | 'replace';
export type PeopleActionError = PeopleActionKind | 'refused';

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
	/** Who was just added, for the confirmation under the list. */
	const [added, setAdded] = useState<PersonCandidate | null>(null);
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
		kind: PeopleActionKind,
		change: () => Promise<void>
	): Promise<boolean> => {
		setPendingId(id);
		setActionError(null);
		setAdded(null);
		try {
			await change();
			await reload();
			return true;
		} catch (error) {
			if (error instanceof PersonChangeRefusedError) {
				setActionError('refused');
				// The list may be stale: read who is still eligible.
				await reload();
			} else {
				setActionError(kind);
				// A replacement removes first, so a failed second half changes the list.
				if (kind === 'replace') await reload();
			}
			return false;
		} finally {
			setPendingId(null);
		}
	};

	const addPerson = async (
		candidate: PersonCandidate,
		input: ChangePersonInput
	) => {
		const done = await runChange(candidate.id, 'add', () =>
			source.addPerson
				? source.addPerson(candidate, input)
				: Promise.reject(new Error('add'))
		);
		if (done) setAdded(candidate);
		return done;
	};

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
		added,
		clearActionError: () => {
			setActionError(null);
			setAdded(null);
		},
		reload,
		addPerson,
		removePerson,
		replacePerson
	};
};
