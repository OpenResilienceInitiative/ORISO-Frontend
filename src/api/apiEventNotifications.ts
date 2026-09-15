import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export interface EventNotificationFeedItem {
	id: number;
	eventType: string;
	category: 'system' | 'message';
	title: string;
	text: string;
	actionPath?: string;
	actionLabel?: string;
	sourceSessionId?: number;
	params?: string | Record<string, unknown>;
	createdAt: string | null;
	readAt: string | null;
}

export interface EventNotificationFeedResponse {
	items: EventNotificationFeedItem[];
	unreadCount: number;
	page: number;
	perPage: number;
	/**
	 * #1377 slice 7: event types the server left out of `unreadCount`. Absent
	 * or empty on a server without exclusion support, so a client that asked
	 * for exclusions can tell an exact total from an ignored parameter.
	 */
	excludedEventTypes?: string[];
}

const eventTypesParam = (name: string, types?: ReadonlyArray<string>) =>
	types && types.length > 0
		? `&${name}=${encodeURIComponent(types.join(','))}`
		: '';

export const apiGetEventNotifications = async (
	page = 0,
	perPage = 50,
	excludeEventTypes?: ReadonlyArray<string>
): Promise<EventNotificationFeedResponse> =>
	fetchData({
		url: `${endpoints.eventNotifications}?page=${page}&perPage=${perPage}${eventTypesParam(
			'excludeEventTypes',
			excludeEventTypes
		)}`,
		method: FETCH_METHODS.GET
	});

/** #1377 slice 7: the unread total without hidden kinds (exact badge). */
export const apiGetEventNotificationsUnreadCount = async (
	excludeEventTypes?: ReadonlyArray<string>
): Promise<{ unreadCount: number; excludedEventTypes?: string[] }> =>
	fetchData({
		url: `${endpoints.eventNotifications}/unread-count?page=0${eventTypesParam(
			'excludeEventTypes',
			excludeEventTypes
		)}`,
		method: FETCH_METHODS.GET
	});

/** #1377 slice 7: "hidden ⇒ read" across unloaded pages. */
export const apiMarkEventNotificationsReadByTypes = async (
	eventTypes: ReadonlyArray<string>
): Promise<{ updated: number; eventTypes?: string[] }> =>
	fetchData({
		url: `${endpoints.eventNotifications}/read?eventTypes=${encodeURIComponent(
			eventTypes.join(',')
		)}`,
		method: FETCH_METHODS.PATCH
	});

export const apiMarkEventNotificationRead = async (
	notificationId: string | number
): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/${notificationId}/read`,
		method: FETCH_METHODS.PATCH
	});

export const apiMarkAllEventNotificationsRead = async (): Promise<any> =>
	fetchData({
		url: `${endpoints.eventNotifications}/read-all`,
		method: FETCH_METHODS.PATCH
	});

export const apiClearEventNotifications = async (): Promise<any> =>
	fetchData({
		url: endpoints.eventNotifications,
		method: FETCH_METHODS.DELETE
	});
