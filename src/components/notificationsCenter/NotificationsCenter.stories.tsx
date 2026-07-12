import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationsCenter } from './NotificationsCenter';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import {
	NotificationsContext,
	UserDataContext,
	AUTHORITIES
} from '../../globalState';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';

/**
 * WP-06 Activity Timeline mock feed. Covers every seeded event family
 * (requests, messages, drafts, handover, calls, system) so the timeline,
 * family filter chips, unread states and the consent card are all visible
 * without live app data (ADR-AT-01: strings render client-side from the
 * event-descriptor registry; title/text here are only legacy fallbacks).
 */
const minutesAgo = (min: number) =>
	new Date(Date.now() - min * 60 * 1000).toISOString();

const feedItem = (
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

const mockFeed: NotificationFeedItem[] = [
	feedItem({
		id: '1',
		eventType: 'message.new',
		category: 'message',
		createdAt: minutesAgo(4),
		actionPath: '/sessions/consultant/sessionView/room-101/101',
		sourceSessionId: '101'
	}),
	feedItem({
		id: '2',
		eventType: 'thread.reply.new',
		category: 'message',
		createdAt: minutesAgo(22),
		actionPath:
			'/sessions/consultant/sessionView/room-101/101?threadRootId=evt-abc',
		sourceSessionId: '101'
	}),
	feedItem({
		id: '3',
		eventType: 'request.new',
		createdAt: minutesAgo(45),
		actionPath: '/sessions/consultant/sessionPreview'
	}),
	feedItem({
		id: '3a',
		eventType: 'appointment.requested',
		createdAt: minutesAgo(50)
	}),
	feedItem({
		id: '3b',
		eventType: 'request.denied',
		createdAt: minutesAgo(70),
		readAt: minutesAgo(65),
		actionPath: '/sessions/consultant/sessionPreview'
	}),
	feedItem({
		id: '4',
		eventType: 'inquiry.accepted',
		createdAt: minutesAgo(90),
		readAt: minutesAgo(60),
		actionPath: '/sessions/consultant/sessionView/room-102/102',
		sourceSessionId: '102'
	}),
	feedItem({
		id: '5',
		eventType: 'case.handover.consent.requested',
		createdAt: minutesAgo(130),
		actionPath: '/sessions/user/view/room-103/103?caseHandoverRequestId=42',
		sourceSessionId: '103'
	}),
	feedItem({
		id: '6',
		eventType: 'handover.denied',
		createdAt: minutesAgo(200),
		readAt: minutesAgo(180),
		sourceSessionId: '104'
	}),
	feedItem({
		id: '7',
		eventType: 'draft.created',
		createdAt: minutesAgo(300),
		readAt: minutesAgo(280),
		actionPath: '/sessions/consultant/sessionView/room-101/101'
	}),
	feedItem({
		id: '8',
		eventType: 'call.missed',
		createdAt: minutesAgo(60 * 26),
		sourceSessionId: '105'
	}),
	feedItem({
		id: '9',
		eventType: 'call.ended',
		createdAt: minutesAgo(60 * 30),
		readAt: minutesAgo(60 * 29),
		sourceSessionId: '105'
	}),
	feedItem({
		id: '9a',
		eventType: 'call.invited',
		createdAt: minutesAgo(60 * 32),
		sourceSessionId: '106'
	}),
	feedItem({
		id: '9b',
		eventType: 'appointment.cancelled',
		createdAt: minutesAgo(60 * 36),
		readAt: minutesAgo(60 * 35)
	}),
	feedItem({
		id: '9c',
		eventType: 'appointment.scheduled',
		createdAt: minutesAgo(60 * 40),
		readAt: minutesAgo(60 * 39)
	}),
	feedItem({
		id: '9d',
		eventType: 'appointment.briefing',
		createdAt: minutesAgo(60 * 44),
		readAt: minutesAgo(60 * 43)
	}),
	feedItem({
		id: '9e',
		eventType: 'waiting_room.client.joined',
		createdAt: minutesAgo(60 * 46)
	}),
	feedItem({
		id: '10',
		eventType: 'supervisor.added',
		createdAt: minutesAgo(60 * 50),
		readAt: minutesAgo(60 * 49)
	}),
	feedItem({
		id: '11',
		eventType: 'counselor.renamed',
		createdAt: minutesAgo(60 * 24 * 8),
		readAt: minutesAgo(60 * 24 * 7)
	})
];

const noop = () => {};

const notificationsValue = (feed: NotificationFeedItem[]) => ({
	notifications: [],
	notificationFeed: feed,
	unreadNotificationCount: feed.filter((item) => !item.readAt).length,
	setNotifications: noop,
	hasNotification: () => false,
	addNotification: noop,
	addEventNotification: noop,
	refreshNotificationFeed: noop,
	removeNotification: noop,
	markNotificationAsRead: noop,
	markAllNotificationsAsRead: noop,
	clearNotificationFeed: noop
});

const consultantUserData = {
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

const withTimelineData =
	(feed: NotificationFeedItem[], userData: any = consultantUserData) =>
	(Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: noop,
				reloadUserData: async () => null as any
			}}
		>
			<NotificationsContext.Provider value={notificationsValue(feed)}>
				<div style={{ height: '90vh', display: 'flex' }}>
					<Story />
				</div>
			</NotificationsContext.Provider>
		</UserDataContext.Provider>
	);

const meta = {
	title: 'Organisms/NotificationsCenter',
	component: NotificationsCenter,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/notifications' },
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'WP-06 Activity Timeline: master-detail history of activity events with family-filter chips, client search, per-event icons from the event-descriptor registry and an embedded detail pane. Stories run on a mocked notification feed covering every seeded event family.'
			}
		}
	}
} satisfies Meta<typeof NotificationsCenter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Consultant view with a feed across all event families, mixed read/unread. */
export const FilledTimeline: Story = {
	decorators: [withTimelineData(mockFeed)]
};

/** Client (asker) view — includes the two-button case-handover consent card. */
export const ClientView: Story = {
	decorators: [
		withTimelineData(mockFeed, {
			...consultantUserData,
			userId: 'sb-client',
			userName: 'Storybook Client',
			grantedAuthorities: []
		})
	]
};

/** Empty state. */
export const Empty: Story = {
	decorators: [withTimelineData([])]
};
