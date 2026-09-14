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
}

export const apiGetEventNotifications = async (
	page = 0,
	perPage = 50
): Promise<EventNotificationFeedResponse> =>
	fetchData({
		url: `${endpoints.eventNotifications}?page=${page}&perPage=${perPage}`,
		// Keep transient poll failures local; an expired session still follows 401 handling.
		method: FETCH_METHODS.GET,
		responseHandling: []
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
