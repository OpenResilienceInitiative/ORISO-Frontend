import { getEventDescriptor } from '../components/notificationsCenter/eventDescriptors';
import { EventActionParams } from '../components/notificationsCenter/eventDescriptors/types';
import { TranslateFn } from '../components/notificationsCenter/eventDescriptors/renderEventStrings';
import { NOTIFICATIONS_ROUTE } from '../resources/scripts/notificationRoutes';
import { appConfig } from './appConfig';
import { sendNotification } from './notificationHelpers';
import { notificationSettingsStore } from './notificationSettings/store';
import { playNotificationSound } from './notificationSettings/soundPlayback';

type Announcement = {
	id: string;
	eventType: string;
	sourceSessionId?: string;
	params?: EventActionParams;
};

/** Router navigation, so clicking a banner does not reload the document. */
export type NotificationNavigate = (path: string) => void;

/** Transient channels share an event owner; no decrypted text leaves the app. */
export const announceNotificationEvent = (
	event: Announcement,
	translate: TranslateFn,
	modern = appConfig?.releaseToggles?.enableNewNotifications === true,
	navigate?: NotificationNavigate
): void => {
	const descriptor = getEventDescriptor(event.eventType);
	const sessionId = event.sourceSessionId ?? event.params?.sourceSessionId;
	const segments = window.location.pathname.split('/').map((segment) => {
		try {
			return decodeURIComponent(segment);
		} catch {
			return segment;
		}
	});
	if (
		document.hasFocus() &&
		segments.includes('sessions') &&
		((event.params?.roomRef && segments.includes(event.params.roomRef)) ||
			(sessionId != null && segments.at(-1) === String(sessionId)))
	)
		return;
	const { settings, device } = notificationSettingsStore.getState();
	const mentioned = event.params?.mentioned === true;
	playNotificationSound(
		settings,
		device,
		descriptor.family,
		event.eventType,
		mentioned
	);
	if (!modern) return;
	// Generic translated title only: neither server fallbacks nor interpolation
	// values belong on an OS lock screen. Open the timeline for safe navigation.
	sendNotification(translate(descriptor.titleTemplate), {
		family: descriptor.family,
		eventType: event.eventType,
		mentioned,
		silent: true,
		onclick: () => {
			window.focus();
			// A document navigation here discards in-memory conversation state,
			// including anything not yet persisted. The router keeps it; the
			// global assign stays only for callers that have no router.
			if (navigate) {
				navigate(NOTIFICATIONS_ROUTE);
				return;
			}
			window.location.assign(NOTIFICATIONS_ROUTE);
		}
	});
};

/** Page zero may contain several new events; reading an older row is not arrival. */
export const selectUnseenEvents = <
	T extends { id: string; readAt?: string | null }
>(
	feed: readonly T[],
	seen: ReadonlySet<string> | null
): T[] =>
	seen === null
		? []
		: feed
				.filter((event) => !seen.has(event.id) && !event.readAt)
				.reverse();
