/**
 * FE#779: team-discussion mentions, offered handovers (counsellor) and consent
 * requests that wait for the advice seeker's yes raise one in-app pop-up card
 * per conversation and kind, the row's tone and at most one OS banner, all
 * from the one feed announcement path. Fixtures use the shapes UserService
 * emits. Ordinary messages get no pop-up.
 *
 * @vitest-environment oriso-jsdom
 */

import React, { useContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	NotificationsContext,
	NotificationsProvider
} from './NotificationsProvider';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { setKindField } from '../../utils/notificationSettings/notificationConfig';
import { __resetSoundThrottlesForTests } from '../../utils/notificationSettings/soundPlayback';

const apiGetEventNotifications = vi.fn();

vi.mock('../../api/apiEventNotifications', () => ({
	apiGetEventNotifications: (...args: unknown[]) =>
		apiGetEventNotifications(...args),
	apiMarkEventNotificationRead: vi.fn(() => Promise.resolve()),
	apiMarkEventNotificationsReadByTypes: vi.fn(() =>
		Promise.reject({ status: 404 })
	),
	apiGetEventNotificationsUnreadCount: vi.fn(() =>
		Promise.resolve({ unreadCount: 0 })
	),
	apiMarkAllEventNotificationsRead: vi.fn(() => Promise.resolve()),
	apiClearEventNotifications: vi.fn(() => Promise.resolve())
}));

vi.mock('../../components/sessionCookie/accessSessionCookie', () => ({
	AUTH_SESSION_CHANGE_EVENT: 'oriso:auth-session-change',
	getValueFromCookie: () => 'fake-token'
}));

const NOTICE_TYPE = 'eventNotice';
type Notice = {
	notificationType: string;
	kind: string;
	sessionId: string;
	actorName: string | null;
	count: number;
	path: string | null;
};

const base = (
	id: number,
	eventType: string,
	category: 'message' | 'system',
	actionPath: string,
	params: Record<string, unknown>,
	sessionId: number
) => ({
	id,
	eventType,
	category,
	title: '',
	text: 'PRIVATE MESSAGE TEXT',
	createdAt: new Date(Date.UTC(2026, 9, 28, 12, 0, id)).toISOString(),
	readAt: null,
	sourceSessionId: sessionId,
	actionPath,
	params: { sessionId, ...params }
});

/**
 * The shape UserService emits (TeamDiscussionNotificationService
 * .buildParams): no recipientRole, roomId instead of roomRef, the sender as
 * senderDisplayName, and a path that carries teamDiscussion=1.
 */
const mention = (
	id: number,
	params: Record<string, unknown> = {},
	sessionId = 42
) =>
	base(
		id,
		'team.discussion.new',
		'message',
		`/sessions/consultant/sessionPreview?sessionId=${sessionId}&teamDiscussion=1&roomId=!team${sessionId}`,
		{
			roomId: `!team${sessionId}`,
			senderDisplayName: 'Kollegin Weber',
			mentioned: true,
			...params
		},
		sessionId
	);

/** CaseHandoverService offer to the recipient (buildCaseHandoverOfferParams). */
const handover = (
	id: number,
	params: Record<string, unknown> = {},
	sessionId = 42
) =>
	base(
		id,
		'case.handover.offer.received',
		'system',
		`/sessions/consultant/sessionView/session/${sessionId}?caseHandoverRequestId=7`,
		{
			conversationType: 'AGENCY_COUNSELLING',
			roomRef: `!room${sessionId}`,
			initiatorName: 'Kollege Braun',
			caseHandoverRequestId: 7,
			...params
		},
		sessionId
	);

/** notifyPendingConsent: goes to the advice seeker (buildCaseHandoverParams). */
const consent = (
	id: number,
	params: Record<string, unknown> = {},
	sessionId = 42
) =>
	base(
		id,
		'case.handover.consent.requested',
		'system',
		`/sessions/user/view/session/${sessionId}?caseHandoverRequestId=7`,
		{
			conversationType: 'AGENCY_COUNSELLING',
			roomRef: `!room${sessionId}`,
			requesterName: 'Kollege Braun',
			caseHandoverRequestId: 7,
			clientConsent: 'OPT_IN',
			...params
		},
		sessionId
	);

/** An ordinary message row as the message producer emits it. */
const message = (id: number, params: Record<string, unknown> = {}) =>
	base(
		id,
		'message.new',
		'message',
		'/sessions/consultant/sessionView/!room42/42',
		{
			roomRef: '!room42',
			conversationType: 'AGENCY_COUNSELLING',
			recipientRole: 'consultant',
			senderName: 'Kollegin Weber',
			...params
		},
		42
	);

const Probe = () => {
	const context = useContext(NotificationsContext)!;
	const notices = (context.notifications as unknown as Notice[]).filter(
		(n) => n.notificationType === NOTICE_TYPE
	);
	return (
		<>
			<div data-testid="ids">
				{context.notificationFeed.map((item) => item.id).join(',')}
			</div>
			<div data-testid="notices">
				{notices
					.map(
						(n) =>
							`${n.kind}:${n.sessionId}:${n.count}:${n.actorName}`
					)
					.join(',')}
			</div>
			<div data-testid="path">{notices[0]?.path ?? ''}</div>
			<button onClick={context.refreshNotificationFeed}>refresh</button>
		</>
	);
};

const banners = vi.fn();
const play = vi.fn(() => Promise.resolve());
let permission: NotificationPermission = 'granted';
let visibility: DocumentVisibilityState = 'visible';
let focused = true;

type Item = ReturnType<typeof base>;

/** Mount with an empty history, then deliver `items` as new activity. */
const deliver = async (items: Item[]) => {
	render(
		<NotificationsProvider>
			<Probe />
		</NotificationsProvider>
	);
	await waitFor(() =>
		expect(apiGetEventNotifications).toHaveBeenCalledTimes(1)
	);
	apiGetEventNotifications.mockResolvedValue({
		items,
		unreadCount: items.length
	});
	fireEvent.click(screen.getByText('refresh'));
	await waitFor(() =>
		expect(
			screen.getByTestId('ids').textContent?.split(',').sort()
		).toEqual(items.map((item) => String(item.id)).sort())
	);
};

/** Tones for the rows under test, whatever the factory defaults are. */
const withTones = () => {
	let config =
		notificationSettingsStore.getState().settings.notificationConfig;
	for (const kind of ['mention', 'handover', 'standard'] as const) {
		config = setKindField(config, 'conversations', kind, 'sound', 'ton-1');
	}
	notificationSettingsStore.updateSettings({ notificationConfig: config });
};

describe('NotificationsProvider mention + handover pop-up (FE#779)', () => {
	beforeEach(() => {
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		banners.mockClear();
		play.mockClear();
		permission = 'granted';
		visibility = 'visible';
		focused = true;
		localStorage.clear();
		localStorage.setItem(
			'BROWSER_NOTIFICATIONS',
			JSON.stringify({
				enabled: true,
				initialEnquiry: true,
				newMessage: true
			})
		);
		notificationSettingsStore.resetForTests();
		__resetSoundThrottlesForTests();
		window.history.replaceState({}, '', '/sessions/consultant/sessionView');
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => visibility
		);
		vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
		vi.stubGlobal(
			'Notification',
			class {
				static get permission() {
					return permission;
				}
				static requestPermission = vi.fn();
				constructor(title: string, options: NotificationOptions) {
					banners(title, options);
				}
			}
		);
		vi.stubGlobal(
			'Audio',
			class {
				play = play;
			}
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		notificationSettingsStore.resetForTests();
		window.history.replaceState({}, '', '/');
	});

	it('shows one team-discussion mention card with the sender and plays the mention tone once', async () => {
		withTones();
		await deliver([mention(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
		// The id leaves the query for the path: the bare list route shows no chat.
		expect(screen.getByTestId('path').textContent).toBe(
			'/sessions/consultant/sessionPreview/session/42?teamDiscussion=1&roomId=%21team42'
		);
		expect(play).toHaveBeenCalledTimes(1);

		// A repeated poll of the same rows announces nothing again.
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(screen.getByTestId('notices').textContent).toBe(
			'mention:42:1:Kollegin Weber'
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('shows a handover card for an offered case, with the initiator', async () => {
		withTones();
		await deliver([handover(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'handover:42:1:Kollege Braun'
			)
		);
		expect(screen.getByTestId('path').textContent).toBe(
			'/sessions/consultant/sessionView/session/42?caseHandoverRequestId=7'
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('counts several events of one conversation on one card, one card per conversation and kind', async () => {
		await deliver([
			mention(4),
			mention(3),
			mention(2, {}, 77),
			handover(1)
		]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:2:Kollegin Weber,mention:77:1:Kollegin Weber,handover:42:1:Kollege Braun'
			)
		);
	});

	it.each([
		[
			'a team-discussion post without a mention',
			mention(1, { mentioned: false })
		],
		[
			'a mention row of a normal chat message (no producer sets it yet)',
			message(1, { mentioned: true })
		],
		['an ordinary counselling message', message(1)],
		[
			'an ordinary group message',
			message(1, { conversationType: 'GROUP' })
		],
		[
			'a mention in the advice seeker’s own row',
			{
				...mention(1),
				actionPath: '/sessions/user/view/session/42'
			}
		],
		[
			'a handover status step',
			{ ...handover(1), eventType: 'case.handover.granted' }
		],
		[
			'the consent request in a counsellor row',
			{
				...consent(1),
				actionPath: '/sessions/consultant/sessionView/session/42'
			}
		]
	])('raises no card for %s', async (_label, item) => {
		await deliver([item]);

		expect(screen.getByTestId('notices').textContent).toBe('');
	});

	it.each([
		['OPT_IN', 'consent:42:1:null'],
		['OPT_OUT', ''],
		['NONE', ''],
		[undefined, '']
	])(
		'the advice seeker gets a consent card only when their yes is needed (clientConsent %s)',
		async (clientConsent, expected) => {
			withTones();
			await deliver([consent(1, { clientConsent })]);

			expect(screen.getByTestId('notices').textContent).toBe(expected);
			if (expected) {
				// The staff-only counsellor name never reaches the card.
				expect(screen.getByTestId('notices').textContent).not.toContain(
					'Braun'
				);
				expect(screen.getByTestId('path').textContent).toBe(
					'/sessions/user/view/session/42?caseHandoverRequestId=7'
				);
			}
		}
	);

	it.each([
		[
			'a team discussion (channel=team)',
			mention(1),
			'/sessions/consultant/sessionPreview/!room42/42?channel=team'
		],
		[
			'a team discussion (legacy teamDiscussion=1)',
			mention(1),
			'/sessions/consultant/sessionPreview/session/42?teamDiscussion=1'
		],
		[
			'an offered case',
			handover(1),
			'/sessions/consultant/sessionView/session/42'
		],
		[
			'the consent request’s conversation',
			consent(1),
			'/sessions/user/view/session/42'
		]
	])(
		'is completely silent while %s is on screen: no card, no tone, no OS banner',
		async (_label, item, url) => {
			withTones();
			window.history.replaceState({}, '', url);
			await deliver([item]);

			expect(screen.getByTestId('notices').textContent).toBe('');
			expect(play).not.toHaveBeenCalled();
			expect(banners).not.toHaveBeenCalled();
		}
	);

	it('still announces a mention on the bare query link, which renders the empty list view', async () => {
		withTones();
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionPreview?sessionId=42&teamDiscussion=1&roomId=!team42'
		);
		await deliver([mention(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
	});

	it('still announces a team-discussion mention when the same enquiry is open on its main chat', async () => {
		withTones();
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionPreview/!room42/42'
		);
		await deliver([mention(1)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('stays quiet while notifications are muted', async () => {
		withTones();
		notificationSettingsStore.updateSettings({ globalMute: true });
		await deliver([mention(1), handover(2), consent(3)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(play).not.toHaveBeenCalled();
	});

	it('honours the row: pop-up off keeps tone and sends no banner, no tone keeps the card', async () => {
		withTones();
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'mention',
				'banner',
				'off'
			)
		});
		visibility = 'hidden';
		focused = false;
		await deliver([mention(1)]);
		expect(screen.getByTestId('notices').textContent).toBe('');
		expect(banners).not.toHaveBeenCalled();
		expect(play).toHaveBeenCalledTimes(1);
		cleanup();

		notificationSettingsStore.resetForTests();
		__resetSoundThrottlesForTests();
		play.mockClear();
		apiGetEventNotifications.mockReset();
		apiGetEventNotifications.mockResolvedValue({
			items: [],
			unreadCount: 0
		});
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				notificationSettingsStore.getState().settings
					.notificationConfig,
				'conversations',
				'mention',
				'sound',
				'none'
			)
		});
		await deliver([mention(2)]);
		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber'
			)
		);
		expect(play).not.toHaveBeenCalled();
	});

	it('honours the handover row for the advice seeker’s consent card', async () => {
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'handover',
				'banner',
				'off'
			)
		});
		await deliver([consent(1)]);

		expect(screen.getByTestId('notices').textContent).toBe('');
	});

	it('in a background tab raises exactly one OS banner per event, without message text, and keeps the card', async () => {
		withTones();
		visibility = 'hidden';
		focused = false;
		// Even with this team discussion open: hidden means nobody sees it.
		window.history.replaceState(
			{},
			'',
			'/sessions/consultant/sessionPreview/!room42/42?channel=team'
		);
		await deliver([mention(1), handover(2, {}, 77)]);

		await waitFor(() => expect(banners).toHaveBeenCalledTimes(2));
		expect(JSON.stringify(banners.mock.calls)).not.toContain(
			'PRIVATE MESSAGE TEXT'
		);
		expect(screen.getByTestId('notices').textContent).toBe(
			'mention:42:1:Kollegin Weber,handover:77:1:Kollege Braun'
		);

		// A repeated poll must not banner again.
		fireEvent.click(screen.getByText('refresh'));
		await waitFor(() =>
			expect(apiGetEventNotifications).toHaveBeenCalledTimes(3)
		);
		expect(banners).toHaveBeenCalledTimes(2);
	});

	it('in a background tab without permission stays in-app only and never asks', async () => {
		withTones();
		visibility = 'hidden';
		focused = false;
		permission = 'default';
		await deliver([mention(1), consent(2, {}, 77)]);

		await waitFor(() =>
			expect(screen.getByTestId('notices').textContent).toBe(
				'mention:42:1:Kollegin Weber,consent:77:1:null'
			)
		);
		expect(banners).not.toHaveBeenCalled();
		expect(
			(Notification as unknown as { requestPermission: () => void })
				.requestPermission
		).not.toHaveBeenCalled();
		expect(play).toHaveBeenCalledTimes(2);
	});

	it.each([
		['an ordinary counselling message', message(1)],
		['a group message', message(1, { conversationType: 'GROUP' })],
		['a team-discussion mention', mention(1)],
		['a handover offer', handover(1)]
	])(
		'raises exactly one OS banner for %s in a background tab, however often it is polled',
		async (_label, item) => {
			withTones();
			visibility = 'hidden';
			focused = false;
			await deliver([item]);

			await waitFor(() => expect(banners).toHaveBeenCalledTimes(1));
			for (let poll = 3; poll <= 4; poll += 1) {
				fireEvent.click(screen.getByText('refresh'));
				await waitFor(() =>
					expect(apiGetEventNotifications).toHaveBeenCalledTimes(poll)
				);
			}
			expect(banners).toHaveBeenCalledTimes(1);
		}
	);

	it('sends no OS banner for a row whose pop-up column is off, but keeps the tone', async () => {
		withTones();
		const config =
			notificationSettingsStore.getState().settings.notificationConfig;
		notificationSettingsStore.updateSettings({
			notificationConfig: setKindField(
				config,
				'conversations',
				'standard',
				'banner',
				'off'
			)
		});
		visibility = 'hidden';
		focused = false;
		await deliver([message(1)]);

		expect(play).toHaveBeenCalledTimes(1);
		expect(banners).not.toHaveBeenCalled();
	});
});
