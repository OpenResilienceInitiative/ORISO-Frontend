import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiCancelOwnCallKnock,
	apiGetOwnCallKnock,
	apiStartDirectLinkConversation,
	CallKnockStatus
} from '../../api/apiDirectLinks';
import {
	KnockWaitPhase,
	nextKnockWaitPhase
} from '../knockWaitDialog/knockWaitPhase';
import {
	forgetPendingKnock,
	PendingKnock,
	pendingKnockFrom,
	rememberPendingKnock
} from './directLinkEntryFlow';

export interface DirectLinkKnockDeps {
	getKnock: typeof apiGetOwnCallKnock;
	cancelKnock: typeof apiCancelOwnCallKnock;
	/** "Erneut anklopfen" opens the link again, which knocks anew. */
	start: typeof apiStartDirectLinkConversation;
}

const DEFAULT_DEPS: DirectLinkKnockDeps = {
	getKnock: apiGetOwnCallKnock,
	cancelKnock: apiCancelOwnCallKnock,
	start: apiStartDirectLinkConversation
};

/** The dialog polls; the counsellor's answer usually comes within seconds. */
export const KNOCK_POLL_MS = 3_000;

export const phaseForKnockStatus = (
	status: CallKnockStatus | null | undefined
): KnockWaitPhase =>
	status === 'ADMITTED'
		? 'admitted'
		: status === 'DECLINED'
			? 'declined'
			: 'waiting';

export interface DirectLinkKnockState {
	phase: KnockWaitPhase;
	/** The knock was withdrawn (here or elsewhere): the dialog goes. */
	gone: boolean;
	cancel: () => void;
	knockAgain: () => void;
	close: () => void;
}

/**
 * The person's knock on their own direct-link conversation
 * (ORISO-UserService#1479): polls `GET /users/call-knocks/mine/{id}` while
 * waiting and maps the answer onto the knock dialog's phases (#1834). The
 * phase machine is the dialog's own, so a late answer can never skip a step.
 */
export const useDirectLinkKnock = (
	knock: PendingKnock,
	deps: Partial<DirectLinkKnockDeps> = {},
	pollMs = KNOCK_POLL_MS
): DirectLinkKnockState => {
	const { getKnock, cancelKnock, start } = { ...DEFAULT_DEPS, ...deps };
	const [current, setCurrent] = useState(knock);
	const [phase, setPhase] = useState<KnockWaitPhase>(() =>
		phaseForKnockStatus(knock.status)
	);
	const [gone, setGone] = useState(false);
	const knockingAgain = useRef(false);

	useEffect(() => {
		if (phase !== 'waiting' || gone) return;
		let cancelled = false;
		const poll = async () => {
			try {
				const answer = await getKnock(current.knockId);
				if (cancelled) return;
				if (answer.status === 'CANCELLED') {
					forgetPendingKnock();
					setGone(true);
					return;
				}
				if (
					answer.status === 'ADMITTED' ||
					answer.status === 'DECLINED'
				) {
					setPhase((now) =>
						nextKnockWaitPhase(
							now,
							answer.status === 'ADMITTED'
								? 'admitted'
								: 'declined'
						)
					);
				}
			} catch {
				/* A missed poll is not an answer; the next one asks again. */
			}
		};
		void poll();
		const timer = window.setInterval(poll, pollMs);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [current.knockId, getKnock, gone, phase, pollMs]);

	const cancel = useCallback(() => {
		forgetPendingKnock();
		setGone(true);
		void cancelKnock(current.knockId).catch(() => undefined);
	}, [cancelKnock, current.knockId]);

	const close = useCallback(() => {
		forgetPendingKnock();
		setGone(true);
	}, []);

	const knockAgain = useCallback(() => {
		if (knockingAgain.current) return;
		// Without the link (a knock adopted from another device) or when the
		// link refuses, there is nothing to wait for: the dialog goes.
		if (!current.token) {
			close();
			return;
		}
		knockingAgain.current = true;
		start(current.token)
			.then((conversation) => {
				const fresh = pendingKnockFrom(current.token, conversation);
				if (!fresh) {
					// DIRECT: the link lets the person in without a knock now.
					setPhase((now) =>
						nextKnockWaitPhase(
							nextKnockWaitPhase(now, 'knockAgain'),
							'admitted'
						)
					);
					return;
				}
				const next = { ...fresh, joinExisting: current.joinExisting };
				rememberPendingKnock(next);
				setCurrent(next);
				setPhase((now) => {
					const waiting = nextKnockWaitPhase(now, 'knockAgain');
					return next.status === 'ADMITTED'
						? nextKnockWaitPhase(waiting, 'admitted')
						: waiting;
				});
			})
			.catch(close)
			.finally(() => {
				knockingAgain.current = false;
			});
	}, [close, current.joinExisting, current.token, start]);

	return { phase, gone, cancel, knockAgain, close };
};
