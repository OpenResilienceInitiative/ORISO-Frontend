import { useEffect, useSyncExternalStore } from 'react';
import {
	apiGetTemporaryAccount,
	apiPutMessageRetention,
	RetentionAnswerResult
} from '../../api/apiTemporaryAccount';
import type { TemporaryAccountState } from '../../globalState/interfaces';
import {
	effectiveRetention,
	MessageRetention,
	mustAskGuest
} from './messageRetention';

/*
 * The signed-in guest's own temporary account (ORISO-UserService#1486),
 * read once per page and shared by every message and the composer.
 */
interface Snapshot {
	status: 'idle' | 'loading' | 'ready';
	account: TemporaryAccountState | null;
}

let snapshot: Snapshot = { status: 'idle', account: null };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

const publish = (next: Snapshot) => {
	snapshot = next;
	listeners.forEach((listener) => listener());
};

export const loadTemporaryAccount = (
	{ force = false } = {},
	get = apiGetTemporaryAccount
): Promise<void> => {
	if (inflight) return inflight;
	if (snapshot.status === 'ready' && !force) return Promise.resolve();
	publish({ ...snapshot, status: 'loading' });
	inflight = get()
		.then((account) => publish({ status: 'ready', account }))
		// A failed lookup is no temporary account: nothing is labelled or asked.
		.catch(() => publish({ status: 'ready', account: null }))
		.finally(() => {
			inflight = null;
		});
	return inflight;
};

/** Tests and stories only. */
export const resetTemporaryAccount = (
	account: TemporaryAccountState | null = null,
	status: Snapshot['status'] = account ? 'ready' : 'idle'
) => publish({ status, account });

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** `enabled`: only askers have one; counsellors never ask. */
export const useOwnTemporaryAccount = (enabled: boolean) => {
	const current = useSyncExternalStore(subscribe, () => snapshot);
	useEffect(() => {
		if (enabled) void loadTemporaryAccount();
	}, [enabled]);
	return enabled ? current : { status: 'ready' as const, account: null };
};

const guestChoiceOf = (
	account: TemporaryAccountState
): MessageRetention | undefined =>
	account.keepMessages == null
		? undefined
		: account.keepMessages
			? 'keep'
			: 'delete';

/** What happens to this account's messages; `undefined` while undecided. */
export const retentionOf = (
	account: TemporaryAccountState | null | undefined
): MessageRetention | undefined =>
	account
		? effectiveRetention(account.messageRetention, guestChoiceOf(account))
		: undefined;

export const needsRetentionAnswer = (
	account: TemporaryAccountState | null | undefined
) =>
	Boolean(account) &&
	!account.deleted &&
	mustAskGuest(account.messageRetention, guestChoiceOf(account));

/** Deleted guests read "Gast (gelöscht)" on the counsellor's side. */
export const isDeletedGuest = (
	account: TemporaryAccountState | null | undefined
) => Boolean(account?.deleted || account?.isDeleted);

export const answerRetention = async (
	choice: MessageRetention,
	put = apiPutMessageRetention
): Promise<RetentionAnswerResult> => {
	const result = await put(choice === 'keep');
	if (result === 'saved' && snapshot.account) {
		publish({
			status: 'ready',
			account: {
				...snapshot.account,
				keepMessages: choice === 'keep',
				keepsMessages: choice === 'keep'
			}
		});
	} else {
		// Answered elsewhere, or the platform decides: read what holds.
		await loadTemporaryAccount({ force: true });
	}
	return result;
};
