import { endpoints } from '../resources/scripts/endpoints';
import { fetchData, FETCH_METHODS } from './fetchData';

export interface EventNotificationFeedItem {
	id: number;
	eventType: string;
	category: 'system' | 'message';
	title: string;
	text: string;
	actionPath?: string;
	sourceSessionId?: number;
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
		method: FETCH_METHODS.GET
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

