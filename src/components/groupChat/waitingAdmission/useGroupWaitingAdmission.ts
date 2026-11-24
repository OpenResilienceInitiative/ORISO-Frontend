import { useEffect, useRef, useState } from 'react';
import { apiCancelOwnCallKnock } from '../../../api/apiDirectLinks';
import type { CallKnock } from '../../../api/apiDirectLinks';
import { apiWaitInGroupChat } from '../../../api/apiGroupWaitingRoom';

export interface GroupWaitingAdmissionApi {
	/** "Still here": opens or refreshes the person's entry, returns its state. */
	wait: (chatId: number) => Promise<CallKnock>;
	/** Stop waiting (idempotent). */
	cancel: (entryId: number) => Promise<void>;
}

const userServiceApi: GroupWaitingAdmissionApi = {
	wait: apiWaitInGroupChat,
	cancel: apiCancelOwnCallKnock
};

export type GroupWaitingAdmissionPhase = 'idle' | 'waiting' | 'admitted';

export interface UseGroupWaitingAdmissionOptions {
	chatId: number;
	/** On once the person agreed and waits for a moderator. */
	enabled: boolean;
	/** The moderator clicked "Reinlassen". Called once. */
	onAdmitted: () => void;
	api?: GroupWaitingAdmissionApi;
	/** The server drops an entry not seen for 45 s. */
	intervalMs?: number;
}

/**
 * ORISO-Frontend#2237: the person sits in a group's waiting room and the
 * moderator in the group's call sees them (ORISO-UserService, via
 * WAITING_ROOM). Every round says "still here" and reads whether they were
 * let in; leaving the waiting room stops waiting.
 */
export const useGroupWaitingAdmission = ({
	chatId,
	enabled,
	onAdmitted,
	api = userServiceApi,
	intervalMs = 5000
}: UseGroupWaitingAdmissionOptions): {
	phase: GroupWaitingAdmissionPhase;
} => {
	const [phase, setPhase] = useState<GroupWaitingAdmissionPhase>('idle');
	const apiRef = useRef(api);
	apiRef.current = api;
	const admittedRef = useRef(onAdmitted);
	admittedRef.current = onAdmitted;

	useEffect(() => {
		if (!enabled) {
			setPhase('idle');
			return undefined;
		}
		let stopped = false;
		let admitted = false;
		let entryId: number | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const round = () => {
			apiRef.current
				.wait(chatId)
				.then((entry) => {
					if (stopped) return;
					entryId = entry.id;
					if (entry.status === 'ADMITTED') {
						admitted = true;
						setPhase('admitted');
						admittedRef.current();
						return;
					}
					setPhase('waiting');
					timer = setTimeout(round, intervalMs);
				})
				.catch(() => {
					if (!stopped) timer = setTimeout(round, intervalMs);
				});
		};
		round();
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
			if (!admitted && entryId !== undefined) {
				void apiRef.current.cancel(entryId).catch(() => undefined);
			}
		};
	}, [enabled, chatId, intervalMs]);

	return { phase };
};
