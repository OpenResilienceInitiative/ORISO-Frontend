import * as React from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NotificationsCenter } from './NotificationsCenter';
import { KNOWN_EVENT_TYPES } from './eventDescriptors';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import {
	NotificationsContext,
	SessionsDataContext,
	UserDataContext,
	AUTHORITIES
} from '../../globalState';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	DEFAULT_DISPLAY_FILTERS,
	withSectionOverride
} from '../../utils/displayFilter/model';
import { withDisplayFilterStore } from '../displayFilter/displayFilterStoryStore';
import {
	getMatrixClientService,
	setMatrixClientServiceRef
} from '../../services/matrixClientRegistry';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';

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

/**
 * #1377 slice 3: the display filter comes from the account-data store. The
 * story attaches a synced fake client holding `parameters.displayFilters`
 * so the dialog is live (writes go to the fake) and reset works.
 */
/** System without pill, drafts hidden: the dot is on, no System chip. */
const customisedDisplayFilters = withSectionOverride(
	DEFAULT_DISPLAY_FILTERS,
	'timeline',
	{
		kinds: {
			system: { show: true, pill: false },
			drafts: { show: false, pill: false }
		},
		autoReadHidden: true
	}
);

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

/**
 * #1535: the timeline loads unsent drafts from `/users/drafts` itself. The
 * fetch patch answers only that path, and only while a story is mounted.
 */
let storyDrafts: IUserDraftItem[] | null = null;
let draftsFetchPatched = false;
const patchDraftsFetch = () => {
	if (draftsFetchPatched) return;
	draftsFetchPatched = true;
	const originalFetch = globalThis.fetch.bind(globalThis);
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input.url;
		if (storyDrafts && url.includes('/service/users/drafts')) {
			return new Response(
				JSON.stringify({ items: storyDrafts, page: 0, perPage: 200 }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}
		return originalFetch(input, init);
	};
};

// Set during render: the timeline's own effect fetches before a parent effect runs.
const ServerDraftsScope = ({
	drafts,
	children
}: {
	drafts: IUserDraftItem[];
	children: React.ReactNode;
}) => {
	patchDraftsFetch();
	storyDrafts = drafts;
	// Layout effects run before the timeline's fetch effect; re-set after a prior scope's cleanup.
	React.useLayoutEffect(() => {
		storyDrafts = drafts;
		return () => {
			storyDrafts = null;
		};
	}, [drafts]);
	return <>{children}</>;
};

const withServerDrafts = (Story: React.ComponentType, context: any) => (
	<ServerDraftsScope drafts={context.parameters.serverDrafts ?? []}>
		<Story />
	</ServerDraftsScope>
);

const meta = {
	title: 'Organisms/NotificationsCenter',
	component: NotificationsCenter,
	tags: ['autodocs'],
	decorators: [withDisplayFilterStore, withServerDrafts],
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

const firstResponseRoomId = '!timeline-first-response:matrix.storybook.test';
const firstResponseEventId = '$timeline-first-response';
const firstResponseSession: ListItemInterface = {
	consultant: {
		id: 'sb-consultant',
		consultantId: 'sb-consultant',
		username: 'storybook-consultant',
		absent: false,
		absenceMessage: ''
	},
	session: {
		id: 1117,
		agencyId: 1,
		askerMatrixUserId: '@asker:matrix.storybook.test',
		attachment: null,
		consultingType: 1,
		matrixRoomId: firstResponseRoomId,
		e2eLastMessage: null,
		messageDate: 0,
		createDate: '2026-10-08T08:00:00.000Z',
		messagesRead: true,
		postcode: 10115,
		registrationType: 'REGISTERED',
		status: 2,
		videoCallMessageDTO: null,
		topic: { id: 1, name: 'Beratung', description: '' }
	}
};

/** #1117: the actual Matrix hydrator formats a structured first response for the timeline and search. */
export const StructuredFirstResponse: Story = {
	beforeEach: () => {
		const originalService = getMatrixClientService();
		const event = new MatrixEvent({
			event_id: firstResponseEventId,
			room_id: firstResponseRoomId,
			type: 'm.room.message',
			sender: '@carimat:matrix.storybook.test',
			origin_server_ts: Date.parse('2026-10-08T08:01:00.000Z'),
			content: {
				msgtype: 'm.text',
				body: '[SYSTEM_NOTIFICATION]{"type":"FIRST_RESPONSE","version":1,"bausteine":[{"id":"greeting","body":"Schön, dass Sie sich gemeldet haben."}]}'
			}
		});
		const room = {
			roomId: firstResponseRoomId,
			findEventById: (id: string) =>
				id === firstResponseEventId ? event : null
		};
		setMatrixClientServiceRef({
			getClient: () => ({
				getUserId: () => '@storybook:matrix.storybook.test',
				getRoom: (id: string) =>
					id === firstResponseRoomId ? room : null,
				on: noop,
				off: noop
			})
		} as any);
		return () => setMatrixClientServiceRef(originalService);
	},
	decorators: [
		withTimelineData([
			feedItem({
				id: 'first-response-1117',
				eventType: 'message.new',
				category: 'message',
				createdAt: minutesAgo(4),
				sourceSessionId: '1117',
				params: {
					roomRef: firstResponseRoomId,
					matrixEventId: firstResponseEventId,
					senderName: 'Carimat'
				}
			})
		]),
		(Story) => (
			<SessionsDataContext.Provider
				value={{
					sessions: [firstResponseSession],
					ready: true,
					dispatch: noop
				}}
			>
				<Story />
			</SessionsDataContext.Provider>
		)
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(
				'Carimat: Schön, dass Sie sich gemeldet haben.'
			)
		).toBeVisible();
		await expect(canvasElement).not.toHaveTextContent('FIRST_RESPONSE');
		const search = canvas.getByRole('searchbox', {
			name: 'Aktivität durchsuchen…'
		});
		await userEvent.type(search, 'Schön, dass Sie sich gemeldet haben.');
		await expect(
			canvas.getByText('Carimat: Schön, dass Sie sich gemeldet haben.')
		).toBeVisible();
		await userEvent.clear(search);
	}
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

/**
 * #1377 slice 3: a customised display filter — drafts hidden (no card, no
 * chip), System shown without a pill (no chip although unread), the tune
 * button carries the dot, and the dialog opens from it.
 */
export const WithDisplayFilter: Story = {
	decorators: [withTimelineData(mockFeed)],
	parameters: { displayFilters: customisedDisplayFilters },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Ansicht einstellen' })
			).toBeVisible()
		);
		await expect(
			canvas.queryByRole('button', { name: /^Entwürfe/ })
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole('button', { name: /^System/ })
		).not.toBeInTheDocument();
		await expect(
			canvas
				.getByRole('button', { name: 'Ansicht einstellen' })
				.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	}
};

/** The dialog wired to the store: reset removes the override (dot goes). */
export const DisplayFilterDialogOpen: Story = {
	decorators: [withTimelineData(mockFeed)],
	parameters: { displayFilters: customisedDisplayFilters },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Ansicht einstellen' })
		);
		// MUI fades the surface in; wait for the transition to settle.
		await waitFor(() => expect(body.getByRole('dialog')).toBeVisible());
		await expect(
			body.getByRole('checkbox', { name: 'In der Liste: Entwürfe' })
		).not.toBeChecked();
		await expect(
			body.getByRole('button', { name: 'Pille: System' })
		).toHaveTextContent('Aus');
	}
};

/** Empty state. */
export const Empty: Story = {
	decorators: [withTimelineData([])]
};

/**
 * QA sweep: one card per seeded event type (all 32, unread), so every
 * descriptor's icon, i18n strings and detail rendering can be checked in one
 * place. Order follows the registry.
 */
export const AllEventTypes: Story = {
	decorators: [
		withTimelineData(
			KNOWN_EVENT_TYPES.map((eventType, index) =>
				feedItem({
					id: `qa-${index}`,
					eventType,
					createdAt: minutesAgo(5 + index * 7),
					sourceSessionId: '101',
					actionPath: '/sessions/consultant/sessionView/room-101/101',
					// #846: mirror the backend params contract so interpolated
					// templates ({{senderDisplayName}}) render realistically.
					params:
						eventType === 'team.discussion.new'
							? {
									roomRef: '!team:matrix.example',
									senderDisplayName: 'Marge Bouvier',
									mentioned: false
								}
							: undefined
				})
			)
		)
	]
};

/**
 * #876: a planned maintenance notice to counselling-centre admins. Title and
 * text render from the locale catalogue with the window from the event params
 * (the server title/text below are only the English fallback and must not
 * show). The action opens the public status page in a new tab.
 */
const plannedServiceNotice = (
	params: NotificationFeedItem['params']
): NotificationFeedItem =>
	feedItem({
		id: 'notice-1',
		eventType: 'service.notice.planned',
		createdAt: minutesAgo(3),
		title: 'Planned maintenance',
		text: 'Planned maintenance on 2026-10-15 from 22:00 to 23:30. Current status: https://status.example.org/',
		params
	});

const plannedServiceNoticeFeed = (params: NotificationFeedItem['params']) => [
	plannedServiceNotice(params),
	...mockFeed.slice(0, 3)
];

const PLANNED_NOTICE_PARAMS = {
	campaignKey: 'maint-2026-10-15',
	maintenanceDate: '2026-10-15',
	maintenanceStart: '22:00',
	maintenanceEnd: '23:30',
	statusUrl: 'https://status.example.org/'
};

export const PlannedServiceNotice: Story = {
	decorators: [
		withTimelineData(plannedServiceNoticeFeed(PLANNED_NOTICE_PARAMS))
	],
	// The detail pane with the status-page link exists from 1200 px upwards.
	globals: { viewport: { value: 'desktop1440' } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getAllByText(/Geplante Wartung|Scheduled maintenance/)
					.length
			).toBeGreaterThan(0)
		);
		await expect(canvas.getAllByText(/22:00/).length).toBeGreaterThan(0);
		await expect(
			canvas.queryByText(/Current status:/)
		).not.toBeInTheDocument();
		const link = await canvas.findByRole('link', {
			name: /Statusseite ansehen|View status page/
		});
		await expect(link).toHaveAttribute(
			'href',
			'https://status.example.org/'
		);
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
		await expect(link).toHaveAccessibleName(
			/(öffnet in einem neuen Tab|opens in a new tab)/
		);
	}
};

/**
 * On a phone the card has no detail pane: tapping it opens the status page in
 * a new tab instead of jumping into the conversation list.
 */
export const PlannedServiceNoticeOnPhone: Story = {
	decorators: [
		withTimelineData(plannedServiceNoticeFeed(PLANNED_NOTICE_PARAMS))
	],
	globals: { viewport: { value: 'phone390' } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const view = canvasElement.ownerDocument.defaultView!;
		const open = fn();
		const original = view.open;
		view.open = open as unknown as typeof view.open;
		try {
			const title = await canvas.findByText(
				/Geplante Wartung|Scheduled maintenance/
			);
			await userEvent.click(title);
			await expect(open).toHaveBeenCalledTimes(1);
			await expect(open).toHaveBeenCalledWith(
				'https://status.example.org/',
				'_blank',
				'noopener,noreferrer'
			);
		} finally {
			view.open = original;
		}
	}
};

/** Without a valid status link the notice still shows, with no open action. */
export const PlannedServiceNoticeWithoutStatusLink: Story = {
	decorators: [
		withTimelineData(
			plannedServiceNoticeFeed({
				...PLANNED_NOTICE_PARAMS,
				statusUrl: undefined
			})
		)
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getAllByText(/Geplante Wartung|Scheduled maintenance/)
					.length
			).toBeGreaterThan(0)
		);
		await expect(
			canvas.queryByRole('link', {
				name: /Statusseite ansehen|View status page/
			})
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole('button', { name: /Chat öffnen|Open chat/ })
		).not.toBeInTheDocument();
	}
};

/**
 * #1535: an unsent draft loaded from the server sits in the timeline next to
 * the two events that used to show as a bare "Activity" card — the asker's
 * first reply ("Ihre ersten Schritte") and the end of an anonymous chat.
 */
export const DraftAndChatEvents: Story = {
	decorators: [
		withTimelineData(
			[
				feedItem({
					id: 'first-response',
					eventType: 'first_response.received',
					createdAt: minutesAgo(3),
					sourceSessionId: '103',
					actionPath: '/sessions/user/view/session/103'
				}),
				feedItem({
					id: 'finished',
					eventType: 'conversation.finished',
					createdAt: minutesAgo(40),
					sourceSessionId: '104',
					params: {
						sourceSessionId: '104',
						roomRef: '!anon:matrix.example'
					}
				})
			],
			{
				...consultantUserData,
				userId: 'sb-client',
				userName: 'Storybook Client',
				grantedAuthorities: []
			}
		)
	],
	parameters: {
		serverDrafts: [
			{
				scopeKey: 'scope:!room103:matrix.example|thread:main',
				text: 'Opaque draft ciphertext',
				actionPath: '/sessions/user/view/session/103',
				sourceSessionId: 103,
				roomRef: '!room103:matrix.example',
				updatedAt: minutesAgo(15)
			}
		]
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getAllByText('Entwurf gespeichert').length
			).toBeGreaterThan(0)
		);
		await expect(
			canvas.getAllByText('Ihre ersten Schritte').length
		).toBeGreaterThan(0);
		await expect(
			canvas.getAllByText('Chat beendet').length
		).toBeGreaterThan(0);
		await expect(canvas.queryByText(/ciphertext/)).not.toBeInTheDocument();
	}
};
