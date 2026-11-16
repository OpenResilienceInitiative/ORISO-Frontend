/**
 * Starting a call from outside its conversation (FE#1050, Frank 2026-11-16):
 * the overview card's "Starten" and the calendar's "Video-Call starten" and
 * "Anruf starten" open the appointment's conversation with a one-shot
 * request in the route state, naming the call kind. The conversation's own
 * call controls (`SessionMenu`) take it up once, with the checks and the
 * start of their own button for that kind. Nothing here decides whether a
 * call is allowed, and nothing here starts one.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Which of the conversation's own call buttons the request stands for. */
export type CallKind = 'video' | 'audio';

export interface StartCallState {
	startCall: { sessionId: number; kind: CallKind };
}

/** Route state asking the conversation of `sessionId` to start a call. */
export const startCallState = (
	sessionId: number,
	kind: CallKind
): StartCallState => ({ startCall: { sessionId, kind } });

/** The request in a route state, or `undefined` when it holds none. */
export const startCallRequestOf = (
	state: unknown
): StartCallState['startCall'] | undefined => {
	const request = (state as Partial<StartCallState> | null)?.startCall;
	return typeof request?.sessionId === 'number' &&
		(request.kind === 'video' || request.kind === 'audio')
		? request
		: undefined;
};

/**
 * Whether the click that asked for the call still counts as the person's
 * gesture. `startRoomCall` asks for camera and microphone, which mobile
 * Safari allows only with the gesture alive; after the conversation has
 * loaded it may have run out (Chromium keeps it for 5 s). Without the
 * browser's answer it counts as run out.
 */
export const userGestureIsLive = () =>
	(navigator as Navigator & { userActivation?: { isActive?: boolean } })
		.userActivation?.isActive === true;

/** History entries whose request was taken up, also across a remount. */
const takenUp = new Set<string>();

/** One of the conversation's own call buttons, as the request sees it. */
export interface CallControl {
	/** The button would be offered: its own visibility checks. */
	allowed: boolean;
	/** The button's own start, as its click runs it. */
	start: () => void;
	/** No live gesture: point at the button instead. */
	offer: () => void;
	/** A check refuses the call: say so; the conversation stays open. */
	refuse: () => void;
}

export interface StartCallRequestProps {
	/** The conversation on screen. */
	sessionId: number | undefined;
	/** The call controls' checks have their answer (settings, agency). */
	settled: boolean;
	/** The conversation's own call buttons, by kind. */
	calls: Record<CallKind, CallControl>;
}

/**
 * Takes up a start request once its checks have answered: starts, offers
 * the button, or refuses, each with the button of the requested kind only.
 * The request is removed from the history entry at once, so a reload, a
 * remount or a way back never starts a second call.
 */
export const StartCallRequest = ({
	sessionId,
	settled,
	calls
}: StartCallRequestProps) => {
	const location = useLocation();
	const navigate = useNavigate();
	const request = startCallRequestOf(location.state);
	const kind = request?.sessionId === sessionId ? request.kind : undefined;
	const allowed = kind ? calls[kind].allowed : false;

	useEffect(() => {
		if (!kind || !settled) return;
		if (takenUp.has(location.key)) return;
		takenUp.add(location.key);
		const { startCall: _taken, ...rest } =
			location.state as StartCallState & Record<string, unknown>;
		navigate(
			{
				pathname: location.pathname,
				search: location.search,
				hash: location.hash
			},
			{
				replace: true,
				state: Object.keys(rest).length > 0 ? rest : null
			}
		);
		const control = calls[kind];
		if (!allowed) control.refuse();
		else if (userGestureIsLive()) control.start();
		else control.offer();
		// Once per request: the handlers are read when it is taken up.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [kind, settled, allowed, location.key]);

	return null;
};
