import * as React from 'react';
import {
	NotificationsContext,
	UserDataContext,
	AUTHORITIES
} from '../src/globalState';
import type { NotificationFeedItem } from '../src/globalState/provider/NotificationsProvider';

export const minutesAgo = (min: number) =>
	new Date(Date.now() - min * 60 * 1000).toISOString();

export const feedItem = (
	overrides: Partial<NotificationFeedItem> & {
		id: string;
		eventType: string;
		createdAt: string;
	}
): NotificationFeedItem => ({
	type: 'info',
	title: '',
	text: '',
	readAt: null,
	category: 'system',
	...overrides
});

export const noop = () => {};

export const notificationsValue = (feed: NotificationFeedItem[]) => ({
	notifications: [],
	notificationFeed: feed,
	unreadNotificationCount: feed.filter((item) => !item.readAt).length,
	serverUnreadTotal: feed.filter(
		(item) => !item.readAt && !item.id.startsWith('local-')
	).length,
	serverUnreadTotalExcludesHidden: false,
	hasUnreadNotifications: feed.some((item) => !item.readAt),
	timelineDisplayFilter: { kinds: {}, autoReadHidden: false },
	visibleUnreadCount: feed.filter((item) => !item.readAt).length,
	hiddenUnreadInLoadedPages: 0,
	markNotificationsReadConfirmed: async () => {},
	setNotifications: noop,
	hasNotification: () => false,
	addNotification: noop,
	addEventNotification: noop,
	refreshNotificationFeed: noop,
	loadOlderNotifications: async () => {},
	hasOlderNotifications: false,
	isLoadingOlderNotifications: false,
	olderNotificationsError: false,
	removeNotification: noop,
	markNotificationAsRead: noop,
	markAllNotificationsAsRead: noop,
	clearNotificationFeed: noop
});

export const consultantUserData = {
	userId: 'sb-consultant',
	userName: 'Storybook Consultant',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	isWalkThroughEnabled: false,
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

export const withTimelineData =
	(
		feed: NotificationFeedItem[],
		userData: any = consultantUserData,
		notifications: Partial<ReturnType<typeof notificationsValue>> = {}
	) =>
	(Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: noop,
				reloadUserData: async () => null as any
			}}
		>
			<NotificationsContext.Provider
				value={{ ...notificationsValue(feed), ...notifications }}
			>
				<div style={{ height: '90vh', display: 'flex' }}>
					<Story />
				</div>
			</NotificationsContext.Provider>
		</UserDataContext.Provider>
	);
