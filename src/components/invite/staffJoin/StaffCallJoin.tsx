/**
 * ORISO-Frontend#2356 (product owner, 25 Nov 2026): a signed-in counsellor who
 * opens a Direkteinladung joins its call only, with their own account, also
 * from another Träger. No sign-out, no guest account. The conversation's
 * counsellor lets them in like a guest ("Anklopfen"); a counsellor who is
 * already in the conversation is taken there.
 *
 * Once seated, the call opens through the same call-only entry share-link
 * guests use (`callManager.joinSharedCall`, inside the signed-in app shell);
 * the conversation is never opened.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiLeaveStaffJoin,
	apiStaffJoin,
	type StaffJoin
} from '../../../api/apiStaffJoin';
import type { SharedCallSeat } from '../../../api/apiJoinSharedCall';
import { callManager } from '../../../services/CallManager';
import { loadAuthenticatedApp } from '../../app/appChunks';
import { Loading } from '../../app/Loading';
import { lazyWithReload } from '../../../utils/chunkLoadRecovery';
import { loginPathForDirectLink } from '../../../utils/directLinkReturn';
import { StaffCallJoinRoom, type StaffJoinPhase } from './StaffCallJoinRoom';
import type { InviteLinkContext } from '../../../api/apiGetInviteLinkContext';
import { directLinkMediumOf } from '../../directLinkEntry/directLinkEntryFlow';

const AuthenticatedApp = lazyWithReload(loadAuthenticatedApp);

/** How often a waiting page asks again; the knock is the gate, not the poll. */
export const STAFF_JOIN_POLL_MS = 3000;
/** Before the call starts nobody is rung: a calmer rhythm. */
export const STAFF_JOIN_NOT_STARTED_POLL_MS = 5000;

/**
 * Which links a counsellor can join: a Direkteinladung for audio or video with
 * an appointment. Every other link keeps the "Sie sind als Beraterin
 * angemeldet" notice: without an appointment each person gets their own
 * conversation, so there is no shared call (the server answers NO_SHARED_CALL).
 */
export const staffCallMediumOf = (
	context: InviteLinkContext | null | undefined
): 'AUDIO' | 'VIDEO' | null => {
	const medium = directLinkMediumOf(context);
	return (medium === 'AUDIO' || medium === 'VIDEO') &&
		context?.linkKind !== 'CALL' &&
		Boolean(context?.appointmentStartTime)
		? medium
		: null;
};

export const OWN_SESSIONS_PATH = '/sessions/consultant/sessionView';
export const ownSessionPath = (sessionId: number) =>
	`/sessions/consultant/sessionView/session/${sessionId}`;

export interface StaffCallJoinDeps {
	join: (token: string, waitingFor?: number) => Promise<StaffJoin>;
	leave: (token: string) => Promise<void>;
	navigate: (path: string) => void;
	/**
	 * Renders the seated call; the app shell by default. `onEnded` is for a
	 * call that was entered and is over; `onFailed` for an entry that did not
	 * work, which the page offers to retry.
	 */
	renderCall: (
		seat: SharedCallSeat,
		onEnded: () => void,
		onFailed: () => void
	) => React.ReactNode;
}

const assignLocation = (path: string) => window.location.assign(path);

type State =
	| { phase: Exclude<StaffJoinPhase, 'waiting'> }
	| { phase: 'waiting'; knockId: number }
	| { phase: 'seated'; seat: SharedCallSeat };

const phaseOfError = (error: unknown): 'forbidden' | 'error' => {
	const status = (error as Response | undefined)?.status;
	return status === 403 || status === 410 || status === 404
		? 'forbidden'
		: 'error';
};

export const StaffCallJoin = ({
	token,
	medium,
	deps
}: {
	token: string;
	medium: 'AUDIO' | 'VIDEO';
	deps?: Partial<StaffCallJoinDeps>;
}) => {
	const join = deps?.join ?? apiStaffJoin;
	const leave = deps?.leave ?? apiLeaveStaffJoin;
	const navigate = deps?.navigate ?? assignLocation;
	const renderCall = deps?.renderCall ?? defaultRenderCall(token);
	const [state, setState] = useState<State>({ phase: 'offer' });
	const mounted = useRef(true);
	/* Bumped on "Abbrechen": an answer to a request sent before it is stale
	   and must neither bring the waiting room back nor open the call. */
	const attempt = useRef(0);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[]
	);
	/* Stable: the seated call must not leave and re-enter on a re-render. */
	const ended = useCallback(() => {
		if (mounted.current) setState({ phase: 'ended' });
	}, []);
	/* Entering failed (busy, unavailable, an error): the call may well still
	   run, so the page offers to try again instead of saying it is over. */
	const failed = useCallback(() => {
		if (mounted.current) setState({ phase: 'error' });
	}, []);

	const visit = useCallback(
		async (waitingFor?: number) => {
			const mine = attempt.current;
			const current = () => mounted.current && mine === attempt.current;
			try {
				const answer = await join(token, waitingFor);
				if (!current()) return;
				switch (answer.outcome) {
					case 'MEMBER':
						navigate(ownSessionPath(answer.sessionId));
						return;
					case 'WAITING':
						setState({ phase: 'waiting', knockId: answer.knockId });
						return;
					case 'SEATED':
						setState({ phase: 'seated', seat: answer.seat });
						return;
					case 'CALL_NOT_RUNNING':
						setState({ phase: 'notStarted' });
						return;
					case 'REFUSED':
						setState({ phase: 'refused' });
						return;
					case 'NO_SHARED_CALL':
						setState({ phase: 'forbidden' });
						return;
				}
			} catch (error) {
				if (current()) setState({ phase: phaseOfError(error) });
			}
		},
		[join, navigate, token]
	);

	/* Asking again is the poll: the server answers with the open knock, the
	   seat once admitted, or that the call has not started. */
	const knockId = state.phase === 'waiting' ? state.knockId : undefined;
	const polling = state.phase === 'waiting' || state.phase === 'notStarted';
	useEffect(() => {
		if (!polling) return;
		const timer = setTimeout(
			() => void visit(knockId),
			knockId ? STAFF_JOIN_POLL_MS : STAFF_JOIN_NOT_STARTED_POLL_MS
		);
		return () => clearTimeout(timer);
	}, [polling, knockId, visit, state]);

	/* Leaving the page while knocking: the knock stops ringing. */
	const waiting = state.phase === 'waiting';
	useEffect(() => {
		if (!waiting) return;
		return () => {
			void leave(token).catch(() => undefined);
		};
	}, [waiting, leave, token]);

	if (state.phase === 'seated') {
		return <>{renderCall(state.seat, ended, failed)}</>;
	}
	return (
		<StaffCallJoinRoom
			phase={state.phase}
			medium={medium}
			onJoin={() => {
				setState({ phase: 'joining' });
				void visit();
			}}
			onCancel={() => {
				attempt.current += 1;
				void leave(token).catch(() => undefined);
				setState({ phase: 'offer' });
			}}
			onOpenOwnSessions={() => navigate(OWN_SESSIONS_PATH)}
		/>
	);
};

const defaultRenderCall = (token: string) => {
	const render = (
		seat: SharedCallSeat,
		onEnded: () => void,
		onFailed: () => void
	) => (
		<React.Suspense fallback={<Loading layout="page" />}>
			<AuthenticatedApp
				onAppReady={() => undefined}
				onLogout={() => undefined}
				loginPath={loginPathForDirectLink(token)}
				content={
					<StaffCallSeat
						seat={seat}
						onEnded={onEnded}
						onFailed={onFailed}
					/>
				}
			/>
		</React.Suspense>
	);
	return render;
};

/**
 * Enters the call room the server seated the counsellor in, with the
 * counsellor's own Matrix client, and reports when the call is over.
 */
export const StaffCallSeat = ({
	seat,
	onEnded,
	onFailed
}: {
	seat: SharedCallSeat;
	/** The entered call is over. */
	onEnded: () => void;
	/** Entering did not work; the call may still run. */
	onFailed: () => void;
}) => {
	const [joined, setJoined] = useState(false);
	useEffect(() => {
		const abort = new AbortController();
		const enter = async () => {
			if (abort.signal.aborted) return;
			const result = await callManager
				.joinSharedCall(seat, abort.signal)
				.catch(() => 'unavailable' as const);
			if (abort.signal.aborted) return;
			if (result === 'joined') setJoined(true);
			else onFailed();
		};
		// Let Strict Mode's cleanup cancel the first effect before it joins.
		void Promise.resolve().then(enter);
		return () => {
			abort.abort();
			const active = callManager.getCurrentCall();
			if (active?.sharedCallGuest && active.callId === seat.callId)
				callManager.leaveCall();
		};
	}, [seat, onFailed]);
	useEffect(() => {
		if (!joined) return;
		return callManager.subscribe((call) => {
			if (
				call?.callId !== seat.callId ||
				call.state === 'left' ||
				call.state === 'ended'
			)
				onEnded();
		});
	}, [joined, seat.callId, onEnded]);
	return joined ? null : <Loading layout="page" />;
};
