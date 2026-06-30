import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiClearEventNotifications,
	apiGetEventNotifications,
	apiMarkAllEventNotificationsRead,
	apiMarkEventNotificationRead
} from './apiEventNotifications';
import { fetchData } from './fetchData';

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		eventNotifications:
			'https://api.oriso-dev.site/service/users/event-notifications'
	}
}));

vi.mock('./fetchData', () => ({
	FETCH_METHODS: {
		DELETE: 'DELETE',
		GET: 'GET',
		PATCH: 'PATCH'
	},
	fetchData: vi.fn()
}));

describe('apiEventNotifications', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads a paginated notification feed', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			items: [],
			page: 2,
			perPage: 25,
			unreadCount: 0
		});

		await apiGetEventNotifications(2, 25);

		expect(fetchData).toHaveBeenCalledWith({
			url: 'https://api.oriso-dev.site/service/users/event-notifications?page=2&perPage=25',
			method: 'GET'
		});
	});

	it('marks one, all, and cleared notification states', async () => {
		vi.mocked(fetchData).mockResolvedValue({});

		await apiMarkEventNotificationRead(123);
		await apiMarkAllEventNotificationsRead();
		await apiClearEventNotifications();

		expect(fetchData).toHaveBeenNthCalledWith(1, {
			url: 'https://api.oriso-dev.site/service/users/event-notifications/123/read',
			method: 'PATCH'
		});
		expect(fetchData).toHaveBeenNthCalledWith(2, {
			url: 'https://api.oriso-dev.site/service/users/event-notifications/read-all',
			method: 'PATCH'
		});
		expect(fetchData).toHaveBeenNthCalledWith(3, {
			url: 'https://api.oriso-dev.site/service/users/event-notifications',
			method: 'DELETE'
		});
	});
});
