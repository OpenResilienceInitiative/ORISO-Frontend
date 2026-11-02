import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Snackbar } from '../../m3Snackbar/M3Snackbar';
import {
	appSnackbarStack,
	SnackbarStack
} from '../../m3Snackbar/snackbarStack';
import { playEventSound } from '../../../utils/notificationSettings/soundPlayback';
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
export const playKnockSound = (): void => playEventSound('chime', 0.6);

const FAILURE_MS = 8000;

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
	/** Where a failed decision is reported. */
	snackbarStack?: SnackbarStack;
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
 * server confirms it. One decision at a time: a second one waits until the
 * first has landed, so two can never contradict each other.
 */
export const useCallKnocks = ({
	enabled,
	scope,
	transport = httpCallKnockTransport,
	playSound = playKnockSound,
	snackbarStack = appSnackbarStack
}: UseCallKnocksOptions): CallKnocksState => {
	const { t } = useTranslation();
	const [knocks, setKnocks] = useState<CallKnock[]>([]);
	const knocksRef = useRef<CallKnock[]>([]);
	knocksRef.current = knocks;
	const [busy, setBusy] = useState<CallKnockBusy>(null);
	const busyRef = useRef<CallKnockBusy>(null);
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

	const failed = useCallback(() => {
		const message = t('groupChat.joinRequest.failed');
		snackbarStack.enqueue({
			announcement: message,
			autoHideDuration: FAILURE_MS,
			render: ({ dismiss }) =>
				React.createElement(M3Snackbar, {
					placement: 'inline',
					role: 'status',
					message,
					onClose: dismiss,
					closeLabel: t('app.close'),
					sx: { maxWidth: 'none' }
				})
		});
	}, [snackbarStack, t]);

	const decide = useCallback(
		async (
			key: Exclude<CallKnockBusy, null>,
			request: () => Promise<void>
		) => {
			if (busyRef.current !== null) return;
			// Only who was on the list when asked: a later arrival still waits.
			const decided =
				key === 'all' ? knocksRef.current.map((k) => k.id) : [key];
			busyRef.current = key;
			setBusy(key);
			try {
				await request();
				setKnocks((current) =>
					current.filter((k) => !decided.includes(k.id))
				);
			} catch {
				// Still waiting: the next poll shows the true state.
				failed();
			} finally {
				busyRef.current = null;
				setBusy(null);
			}
		},
		[failed]
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
