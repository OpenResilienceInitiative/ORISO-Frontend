import {
	FEED_UPDATE_BRIDGE_EVENT,
	matrixLiveEventBridge
} from './matrixLiveEventBridge';
import { messageEventEmitter } from './messageEventEmitter';

/**
 * P2 feed-update signal (ADR-020) — client wiring.
 *
 * Forwards the bridge's content-free `feedUpdated` signal into the existing
 * `messageEventEmitter`, which `NotificationsProvider` already listens to and
 * debounces by 400 ms before calling `refreshNotificationFeed`. The payload is
 * intentionally empty: this is a "your feed changed" nudge, and the rows are
 * still fetched from the authenticated REST feed endpoint.
 *
 * Deliberately NOT `{ refreshSessionList: true }` / `{ refreshEnquiryList: true }`:
 * the session-list flags are derived from the new feed rows by the P1 mapping
 * (`feat/feed-events-refresh-session-lists`), so this signal must not duplicate
 * that decision here.
 *
 * @returns an unbind function for the caller's effect cleanup
 */
export const bindFeedUpdateSignal = (): (() => void) => {
	const handleFeedUpdated = () => {
		messageEventEmitter.emit({});
	};

	matrixLiveEventBridge.on(FEED_UPDATE_BRIDGE_EVENT, handleFeedUpdated);

	return () => {
		matrixLiveEventBridge.off(FEED_UPDATE_BRIDGE_EVENT, handleFeedUpdated);
	};
};
