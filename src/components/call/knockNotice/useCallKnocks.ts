import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewNotificationSound } from '../../../utils/notificationSettings/soundPlayback';
import {
	CallKnock,
	CallKnockScope,
	KnockingPerson,
	knockerName,
	newKnockIds,
	scopeQuery
} from './callKnockModel';
import {
	CallKnockTransport,
	httpCallKnockTransport
} from './callKnockTransport';

/** A short, quiet chime — the counsellor is talking to somebody. */
export const playKnockSound = (): void =>
	previewNotificationSound('chime', 0.6);

export type CallKnockBusy = number | 'all' | null;

export interface UseCallKnocksOptions {
	/** Only while the counsellor is in a call. */
	enabled: boolean;
	/**
	 * The call the knocks belong to. Without one nothing is asked: the notice
	 * and "Alle einlassen" must never reach the counsellor's other calls.
	 */
	scope: CallKnockScope | null;
	transport?: CallKnockTransport;
	playSound?: () => void;
}

export interface CallKnocksState {
	people: KnockingPerson[];
	busy: CallKnockBusy;
	admit: (knockId: number) => Promise<void>;
	decline: (knockId: number) => Promise<void>;
	admitAll: () => Promise<void>;
}

/**
 * The people knocking on the counsellor's current call
 * (ORISO-Frontend#1892): who they are, a chime for every new one, and the
 * three decisions. A decision takes the person off the list as soon as the
 * server confirms it.
 */
export const useCallKnocks = ({
	enabled,
	scope,
	transport = httpCallKnockTransport,
	playSound = playKnockSound
}: UseCallKnocksOptions): CallKnocksState => {
	const [knocks, setKnocks] = useState<CallKnock[]>([]);
	const [busy, setBusy] = useState<CallKnockBusy>(null);
	const known = useRef<Set<number>>(new Set());
	const playRef = useRef(playSound);
	playRef.current = playSound;

	// The scope object may be new on every render; its query is what counts.
	const scopeKey = scope ? scopeQuery(scope) : null;
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	useEffect(() => {
		setKnocks([]);
		known.current = new Set();
		const current = scopeRef.current;
		if (!enabled || !current) return undefined;
		return transport.watchPending(current, (next) => {
			if (newKnockIds(known.current, next).length > 0) playRef.current();
			known.current = new Set(next.map((k) => k.id));
			setKnocks(next);
		});
	}, [enabled, scopeKey, transport]);

	const removeLocally = (ids: number[] | 'all') =>
		setKnocks((current) =>
			ids === 'all' ? [] : current.filter((k) => !ids.includes(k.id))
		);

	const decide = useCallback(
		async (
			key: Exclude<CallKnockBusy, null>,
			request: () => Promise<void>
		) => {
			setBusy(key);
			try {
				await request();
				removeLocally(key === 'all' ? 'all' : [key]);
			} catch {
				// Still waiting: the next poll shows the true state.
			} finally {
				setBusy(null);
			}
		},
		[]
	);

	const admit = useCallback(
		(knockId: number) => decide(knockId, () => transport.admit(knockId)),
		[decide, transport]
	);
	const decline = useCallback(
		(knockId: number) => decide(knockId, () => transport.decline(knockId)),
		[decide, transport]
	);
	const admitAll = useCallback(async () => {
		const current = scopeRef.current;
		// No scope, no "admit all": the server would refuse it (400) anyway.
		if (!current) return;
		await decide('all', () => transport.admitAll(current));
	}, [decide, transport]);

	const people = useMemo(
		() =>
			knocks.map((k) => ({
				id: k.id,
				name: knockerName(k),
				medium: k.medium
			})),
		[knocks]
	);

	return { people, busy, admit, decline, admitAll };
};
