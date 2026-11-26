import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { useLiveChatAvailable } from '../utils/liveChatToggle';
import { getPracticeSnapshot, subscribePractice } from './practiceMode';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

type LiveChatAvailability = ReturnType<typeof useLiveChatAvailable>;

/*
 * FE#2545: "Bin verfügbar" in the practice live-chat tour. While practising,
 * the switch shows and flips this in-memory value only: no API call, no
 * localStorage preference, no heartbeat, so other tabs and the app after
 * practice never see it. It belongs to one practice run (runId): a restart,
 * an exit or a new run starts "off" again, and outside practice the real,
 * backend-owned state shows unchanged. The real hook keeps running beside
 * it, so a counsellor who is really available keeps her real state (and the
 * navigation bar keeps feeding the heartbeat from the real value).
 */
let state: { runId: number; available: boolean } | null = null;
const listeners = new Set<() => void>();

const currentRunId = (): number | null => {
	const snapshot = getPracticeSnapshot();
	return snapshot.status === 'inactive' ? null : snapshot.session.runId;
};

export const getPracticeLiveChatAvailable = (): boolean => {
	const runId = currentRunId();
	if (runId === null || state?.runId !== runId) {
		state = null;
		return false;
	}
	return state.available;
};

/**
 * Flips the practice availability; does nothing outside practice. Switching
 * on tells the tour a macrotask later, so the control's own navigation to the
 * queue lands before the tour moves on (like the click advance).
 */
export const setPracticeLiveChatAvailable = (available: boolean): void => {
	const runId = currentRunId();
	if (runId === null) return;
	const wasAvailable = getPracticeLiveChatAvailable();
	state = { runId, available };
	listeners.forEach((listener) => listener());
	if (available && !wasAvailable) {
		window.setTimeout(() => {
			// Not for a run that ended, or a switch already turned off again.
			if (currentRunId() === runId && getPracticeLiveChatAvailable())
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.liveChatAvailable);
		}, 0);
	}
};

const subscribe = (listener: () => void): (() => void) => {
	listeners.add(listener);
	const offPractice = subscribePractice(listener);
	return () => {
		listeners.delete(listener);
		offPractice();
	};
};

/** 'real' outside practice; otherwise the practice value. */
const readShown = (): 'real' | 'on' | 'off' => {
	if (currentRunId() === null) return 'real';
	return getPracticeLiveChatAvailable() ? 'on' : 'off';
};

const PRACTICE_STATE: LiveChatAvailability[2] = {
	loading: false,
	pending: false,
	error: false,
	lostReason: null
};

/**
 * What a live-chat availability control shows and switches: the real hook's
 * answer outside practice (passed through as is), the practice value while
 * practising (including while practice drains). Wrap `useLiveChatAvailable`
 * with it in every control and list that shows the state; never feed its
 * value to the heartbeat.
 */
export const usePracticeLiveChatAvailability = (
	real: LiveChatAvailability
): LiveChatAvailability => {
	const shown = useSyncExternalStore(subscribe, readShown, () => 'real');
	const setPractice = useCallback(async (available: boolean) => {
		setPracticeLiveChatAvailable(available);
	}, []);
	const practice = useMemo<LiveChatAvailability>(
		() => [shown === 'on', setPractice, PRACTICE_STATE],
		[setPractice, shown]
	);
	return shown === 'real' ? real : practice;
};
