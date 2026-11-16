/**
 * "Starten" outside a conversation (FE#1050, Frank 2026-11-16): the overview
 * card and the calendar's "Video-Call starten" open the appointment's
 * conversation with a one-shot request in the route state. The
 * conversation's own call controls (`SessionMenu`) take it up once, with
 * their own checks and their own start. Nothing here decides whether a call
 * is allowed, and nothing here starts one.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface StartVideoCallState {
	startVideoCall: { sessionId: number };
}

/** Route state asking the conversation of `sessionId` to start its video call. */
export const startVideoCallState = (
	sessionId: number
): StartVideoCallState => ({ startVideoCall: { sessionId } });

const requestedSessionOf = (state: unknown): number | undefined => {
	const sessionId = (state as Partial<StartVideoCallState> | null)
		?.startVideoCall?.sessionId;
	return typeof sessionId === 'number' ? sessionId : undefined;
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

export interface StartVideoCallRequestProps {
	/** The conversation on screen. */
	sessionId: number | undefined;
	/** The call controls' checks have their answer (settings, agency). */
	settled: boolean;
	/** The conversation's own video call button would be offered. */
	allowed: boolean;
	/** The conversation's own start, as its button runs it. */
	start: () => void;
	/** No live gesture: point at the conversation's own button instead. */
	offer: () => void;
	/** A check refuses the call: say so; the conversation stays open. */
	refuse: () => void;
}

/**
 * Takes up a start request once its checks have answered: starts, offers
 * the button, or refuses. The request is removed from the history entry
 * at once, so a reload, a remount or a way back never starts a second call.
 */
export const StartVideoCallRequest = ({
	sessionId,
	settled,
	allowed,
	start,
	offer,
	refuse
}: StartVideoCallRequestProps) => {
	const location = useLocation();
	const navigate = useNavigate();
	const requested = requestedSessionOf(location.state);

	useEffect(() => {
		if (requested === undefined || requested !== sessionId || !settled)
			return;
		if (takenUp.has(location.key)) return;
		takenUp.add(location.key);
		const { startVideoCall: _taken, ...rest } =
			location.state as StartVideoCallState & Record<string, unknown>;
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
		if (!allowed) refuse();
		else if (userGestureIsLive()) start();
		else offer();
		// Once per request: the handlers are read when it is taken up.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requested, sessionId, settled, allowed, location.key]);

	return null;
};
