import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGetSessionRoomBySessionId } from '../../../api/apiGetSessionRooms';
import { resolveAnonymousChatDisplayName } from '../../../utils/anonymousChatDisplayName';
import { previewNotificationSound } from '../../../utils/notificationSettings/soundPlayback';
import { CallKnock, KnockingPerson, newKnockIds } from './callKnockModel';
import {
	CallKnockTransport,
	httpCallKnockTransport
} from './callKnockTransport';

/** The knocking person's User-ID as the session list shows it (#1209). */
export const resolveKnockerName = async (
	sessionId: number
): Promise<string | null> => {
	const { sessions } = await apiGetSessionRoomBySessionId(sessionId);
	const user = sessions?.[0]?.user;
	return resolveAnonymousChatDisplayName(user) || user?.username || null;
};

/** A short, quiet chime — the counsellor is talking to somebody. */
export const playKnockSound = (): void =>
	previewNotificationSound('chime', 0.6);

export type CallKnockBusy = number | 'all' | null;

export interface UseCallKnocksOptions {
	/** Only while the counsellor is in a call. */
	enabled: boolean;
	transport?: CallKnockTransport;
	resolveName?: (sessionId: number) => Promise<string | null>;
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
 * The people knocking on the counsellor's calls (ORISO-Frontend#1892): who
 * they are, a chime for every new one, and the three decisions. A decision
 * takes the person off the list as soon as the server confirms it.
 */
export const useCallKnocks = ({
	enabled,
	transport = httpCallKnockTransport,
	resolveName = resolveKnockerName,
	playSound = playKnockSound
}: UseCallKnocksOptions): CallKnocksState => {
	const [knocks, setKnocks] = useState<CallKnock[]>([]);
	const [names, setNames] = useState<Record<number, string | null>>({});
	const [busy, setBusy] = useState<CallKnockBusy>(null);
	const known = useRef<Set<number>>(new Set());
	const asked = useRef<Set<number>>(new Set());
	const playRef = useRef(playSound);
	playRef.current = playSound;

	useEffect(() => {
		if (!enabled) {
			setKnocks([]);
			known.current = new Set();
			return undefined;
		}
		return transport.watchPending((next) => {
			if (newKnockIds(known.current, next).length > 0) playRef.current();
			known.current = new Set(next.map((k) => k.id));
			setKnocks(next);
		});
	}, [enabled, transport]);

	useEffect(() => {
		knocks.forEach(({ sessionId }) => {
			if (asked.current.has(sessionId)) return;
			asked.current.add(sessionId);
			resolveName(sessionId)
				.catch(() => null)
				.then((name) =>
					setNames((current) => ({ ...current, [sessionId]: name }))
				);
		});
	}, [knocks, resolveName]);

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
	const admitAll = useCallback(
		() => decide('all', () => transport.admitAll()),
		[decide, transport]
	);

	const people = useMemo(
		() =>
			knocks.map((k) => ({
				id: k.id,
				name: names[k.sessionId] ?? null,
				medium: k.medium
			})),
		[knocks, names]
	);

	return { people, busy, admit, decline, admitAll };
};
