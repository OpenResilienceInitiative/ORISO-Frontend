import { useContext, useEffect, useRef } from 'react';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';

/**
 * The events that end a handover offer one way or the other. A request whose
 * outcome arrives as one of these is worth re-reading from the server; every
 * other feed entry is not.
 */
export const CASE_HANDOVER_RESOLUTION_EVENTS = new Set([
	'case.handover.granted',
	'case.handover.consent.declined'
]);

interface UseCaseHandoverResolutionEventsProps {
	/** Scopes the dedupe keys, so one consultant's handled events stay theirs. */
	actorId: string;
	sessionId?: number;
	requestId?: number;
	/** False while no offer is in flight — then there is nothing to refresh. */
	enabled: boolean;
	/**
	 * While this reads true the event is left untouched rather than swallowed:
	 * a local write is in progress and its own response is the better answer.
	 * A ref, not a boolean, because the callers track it in one — a re-render
	 * is exactly what they are avoiding there.
	 */
	pausedRef?: { current: boolean };
	/** Re-read the offer. Must be stable, it is an effect dependency. */
	onResolution: () => void;
}

/**
 * Watches the notification feed for the end of one handover offer.
 *
 * The sender's screen and the recipient's gate both need this, and both had
 * their own copy — same event set, same request matching, same
 * "did I already act on this one" bookkeeping. Two copies of a rule that
 * decides whether a counsellor sees the current owner is one copy too many:
 * whichever drifts first starts showing a stale case.
 *
 * An event carrying no request id counts for the session's offer, because an
 * older producer omits it; an event for another request is ignored.
 */
export const useCaseHandoverResolutionEvents = ({
	actorId,
	sessionId,
	requestId,
	enabled,
	pausedRef,
	onResolution
}: UseCaseHandoverResolutionEventsProps) => {
	const notificationsContext = useContext(NotificationsContext);
	const notificationFeed = notificationsContext?.notificationFeed;
	const handledEventIdsRef = useRef(new Set<string>());

	useEffect(() => {
		if (!enabled || !sessionId || !requestId) return;
		if (pausedRef?.current) return;
		const notification = notificationFeed?.find((item) => {
			const eventRequestId = item.params?.caseHandoverRequestId;
			return (
				CASE_HANDOVER_RESOLUTION_EVENTS.has(item.eventType) &&
				String(item.sourceSessionId) === String(sessionId) &&
				(eventRequestId == null ||
					String(eventRequestId) === String(requestId)) &&
				!handledEventIdsRef.current.has(`${actorId}:${item.id}`)
			);
		});
		if (!notification) return;
		handledEventIdsRef.current.add(`${actorId}:${notification.id}`);
		onResolution();
	}, [
		actorId,
		enabled,
		notificationFeed,
		onResolution,
		pausedRef,
		requestId,
		sessionId
	]);
};
