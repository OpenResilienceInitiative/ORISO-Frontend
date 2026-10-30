// @vitest-environment oriso-jsdom
/**
 * FE#779 — the in-app pop-up for a mention or a case handover: what it says,
 * where "open" leads, when it goes away and which feed rows earn one.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import {
	EventNotice,
	EventNoticeProps,
	eventNoticeActor,
	eventNoticeKindFor,
	isConversationOpen,
	isTeamDiscussionOpen,
	NOTIFICATION_TYPE_EVENT_NOTICE,
	upsertEventNotice
} from './EventNotice';

// The component tags nodes with data-cy (Cypress convention).
configure({ testIdAttribute: 'data-cy' });

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) =>
			opts ? `${key}:${JSON.stringify(opts)}` : key
	})
}));
// vitest has no svgr plugin — stub the icon ReactComponent exports.
vi.mock('../../resources/img/icons/modality-chat.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../resources/img/icons/case_handover_200_24px.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null
}));

const notice = (
	overrides: Partial<EventNoticeProps> = {}
): EventNoticeProps => ({
	id: 'event-notice:mention:42',
	notificationType: NOTIFICATION_TYPE_EVENT_NOTICE,
	kind: 'mention',
	sessionId: '42',
	roomRef: '!room42',
	actorName: 'Kollegin Weber',
	count: 1,
	path: '/sessions/consultant/sessionView/!room42/42',
	...overrides
});

const Where = () => <div data-cy="where">{useLocation().pathname}</div>;
const GoTo = ({ to }: { to: string }) => {
	const navigate = useNavigate();
	return <button onClick={() => navigate(to)}>go</button>;
};

const renderNotice = (
	props: EventNoticeProps,
	start = '/',
	goTo = '/sessions/consultant/sessionView/!room42/42'
) => {
	const removeNotification = vi.fn();
	render(
		<MemoryRouter initialEntries={[start]}>
			<NotificationsContext.Provider
				value={{ removeNotification } as never}
			>
				<EventNotice {...props} />
				<Where />
				<GoTo to={goTo} />
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
	return removeNotification;
};

describe('EventNotice', () => {
	afterEach(cleanup);

	it.each(['mention', 'handover'] as const)(
		'names the actor, never message text, and opens the target (%s)',
		(kind) => {
			const remove = renderNotice(
				notice({ kind, id: `event-notice:${kind}:42` }),
				'/sessions/consultant/sessionView'
			);
			const card = screen.getByRole('status');
			expect(card.textContent).toContain(
				`notification.eventNotice.${kind}.title`
			);
			expect(card.textContent).toContain('Kollegin Weber');
			expect(screen.queryByTestId(`${kind}-notice-count`)).toBeNull();

			fireEvent.click(
				screen.getByRole('button', {
					name: `notification.eventNotice.${kind}.open`
				})
			);
			expect(screen.getByTestId('where').textContent).toBe(
				'/sessions/consultant/sessionView/!room42/42'
			);
			expect(remove).toHaveBeenCalledWith(
				`event-notice:${kind}:42`,
				NOTIFICATION_TYPE_EVENT_NOTICE
			);
		}
	);

	it('shows the count for several events and closes by keyboard-reachable button', () => {
		const remove = renderNotice(notice({ count: 3 }));
		expect(screen.getByTestId('mention-notice-count').textContent).toBe(
			'notification.eventNotice.mention.several:{"count":3}'
		);
		fireEvent.click(screen.getByRole('button', { name: 'app.close' }));
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it.each([
		['handover', '/sessions/consultant/sessionView/!room42/42'],
		['consent', '/sessions/user/view/session/42'],
		[
			'mention',
			'/sessions/consultant/sessionPreview/!main42/42?channel=team'
		]
	] as const)(
		'goes away once the target is opened another way (%s)',
		(kind, to) => {
			const remove = renderNotice(
				notice({ kind, id: `event-notice:${kind}:42` }),
				'/',
				to
			);
			expect(remove).not.toHaveBeenCalled();
			fireEvent.click(screen.getByText('go'));
			expect(remove).toHaveBeenCalledWith(
				`event-notice:${kind}:42`,
				NOTIFICATION_TYPE_EVENT_NOTICE
			);
		}
	);

	it('keeps a mention card when only the main chat of the enquiry is opened', () => {
		const remove = renderNotice(
			notice(),
			'/',
			'/sessions/consultant/sessionPreview/!main42/42'
		);
		fireEvent.click(screen.getByText('go'));
		expect(remove).not.toHaveBeenCalled();
	});

	it('names no one on the consent card and shows its neutral text', () => {
		renderNotice(
			notice({
				kind: 'consent',
				id: 'event-notice:consent:42',
				actorName: 'Kollege Braun',
				path: '/sessions/user/view/session/42?caseHandoverRequestId=7'
			})
		);
		const card = screen.getByRole('status');
		expect(card.textContent).toContain(
			'notification.eventNotice.consent.title'
		);
		expect(card.textContent).toContain(
			'notification.eventNotice.consent.text'
		);
		expect(card.textContent).not.toContain('Braun');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'notification.eventNotice.consent.open'
			})
		);
		expect(screen.getByTestId('where').textContent).toBe(
			'/sessions/user/view/session/42'
		);
	});

	it('waits in a hidden tab even with the target route open, and settles on return', () => {
		let state: DocumentVisibilityState = 'hidden';
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => state
		);
		const remove = renderNotice(
			notice(),
			'/sessions/consultant/sessionPreview/!main42/42?channel=team'
		);
		expect(remove).not.toHaveBeenCalled();
		state = 'visible';
		document.dispatchEvent(new Event('visibilitychange'));
		expect(remove).toHaveBeenCalledTimes(1);
		vi.restoreAllMocks();
	});

	it('offers no open button without a target and shows no name without an actor', () => {
		renderNotice(notice({ path: null, actorName: null }));
		expect(screen.queryByTestId('mention-notice-open')).toBeNull();
		expect(screen.getByRole('status').textContent).not.toContain('.from');
	});
});

describe('event pop-up rules', () => {
	// UserService shapes: the team-discussion producer sets no recipientRole,
	// the handover producers neither; the link tells whose row it is.
	const TEAM =
		'/sessions/consultant/sessionPreview?sessionId=42&teamDiscussion=1&roomId=!team42';
	const OFFER =
		'/sessions/consultant/sessionView/session/42?caseHandoverRequestId=7';
	const ASKER = '/sessions/user/view/session/42?caseHandoverRequestId=7';
	const row = (
		eventType: string,
		actionPath: string,
		params: Record<string, unknown> = {}
	) => ({ eventType, sourceSessionId: '42', actionPath, params });

	it.each([
		[row('team.discussion.new', TEAM, { mentioned: true }), 'mention'],
		[row('case.handover.offer.received', OFFER), 'handover'],
		[
			row('case.handover.consent.requested', ASKER, {
				clientConsent: 'OPT_IN'
			}),
			'consent'
		],
		// An explicit role agrees with the link.
		[
			row('case.handover.offer.received', OFFER, {
				recipientRole: 'consultant'
			}),
			'handover'
		],
		[
			row('case.handover.consent.requested', ASKER, {
				recipientRole: 'user',
				clientConsent: 'OPT_IN'
			}),
			'consent'
		],
		// A post without a mention, and every message.new, earn no card.
		[row('team.discussion.new', TEAM, { mentioned: false }), null],
		[row('team.discussion.new', TEAM), null],
		[
			row('message.new', '/sessions/consultant/sessionView/!room42/42', {
				mentioned: true,
				recipientRole: 'consultant'
			}),
			null
		],
		// The consent request waits for the advice seeker only on OPT_IN.
		[
			row('case.handover.consent.requested', ASKER, {
				clientConsent: 'OPT_OUT'
			}),
			null
		],
		[
			row('case.handover.consent.requested', ASKER, {
				clientConsent: 'NONE'
			}),
			null
		],
		[row('case.handover.consent.requested', ASKER), null],
		// Never in the counsellor's row, whatever the consent mode.
		[
			row(
				'case.handover.consent.requested',
				'/sessions/consultant/sessionView/session/42',
				{ clientConsent: 'OPT_IN' }
			),
			null
		],
		[
			row('case.handover.consent.requested', ASKER, {
				recipientRole: 'consultant',
				clientConsent: 'OPT_IN'
			}),
			null
		],
		// Mention and offer only reach counsellors.
		[
			row('team.discussion.new', '/sessions/user/view/session/42', {
				mentioned: true
			}),
			null
		],
		[
			row('case.handover.offer.received', ASKER, {
				recipientRole: 'user'
			}),
			null
		],
		// Status steps stay in the feed.
		[row('handover.requested', OFFER), null],
		[row('case.handover.granted', OFFER), null],
		[row('handover.all_confirmed', OFFER), null],
		[row('case.handover.consent.declined', OFFER), null],
		[row('request.new', OFFER), null],
		[
			{
				...row('team.discussion.new', TEAM, { mentioned: true }),
				sourceSessionId: ''
			},
			null
		]
	])('%j → %s', (event, kind) => {
		expect(eventNoticeKindFor(event)).toBe(kind);
	});

	it('takes the sender label for a mention, the initiator for an offer and no name for the consent request', () => {
		expect(
			eventNoticeActor(
				'mention',
				row('team.discussion.new', TEAM, {
					senderDisplayName: 'Display',
					senderName: 'Fallback'
				})
			)
		).toBe('Display');
		expect(
			eventNoticeActor(
				'mention',
				row('team.discussion.new', TEAM, { senderName: 'Fallback' })
			)
		).toBe('Fallback');
		expect(
			eventNoticeActor(
				'mention',
				row('team.discussion.new', TEAM, { senderDisplayName: '' })
			)
		).toBeNull();
		expect(
			eventNoticeActor(
				'handover',
				row('case.handover.offer.received', OFFER, {
					initiatorName: 'Initiator'
				})
			)
		).toBe('Initiator');
		expect(
			eventNoticeActor(
				'consent',
				row('case.handover.consent.requested', ASKER, {
					requesterName: 'Staff'
				})
			)
		).toBeNull();
	});

	it('counts on the shown card instead of stacking a second one', () => {
		const other = { id: 'x', notificationType: 'info' as const };
		const first = upsertEventNotice([other], notice());
		const second = upsertEventNotice(first, notice());
		expect(second).toHaveLength(2);
		expect((second[1] as EventNoticeProps).count).toBe(2);
		expect(second[0]).toBe(other);
	});
});

describe('where the target is open', () => {
	const target = { sessionId: '42', roomRef: '!room42' };

	it.each([
		['/sessions/consultant/sessionView/!room42/42', '', true],
		['/sessions/consultant/sessionView/session/42', '?x=1', true],
		['/sessions/user/view/session/42', '', true],
		['/sessions/consultant/sessionPreview/!room42/42', '', true],
		['/sessions/consultant/sessionView/!room43/43', '', false],
		['/sessions/consultant/sessionView/!room4/142', '', false],
		['/sessions/consultant/sessionView/session/42/userProfile', '', false],
		['/sessions/consultant/sessionView', '', false]
	])('conversation %s%s → open=%s', (pathname, search, open) => {
		expect(isConversationOpen(target, pathname, search, true)).toBe(open);
		expect(isConversationOpen(target, pathname, search, false)).toBe(false);
	});

	it.each([
		[
			'/sessions/consultant/sessionPreview/!main42/42',
			'?channel=team',
			true
		],
		[
			'/sessions/consultant/sessionPreview/session/42',
			'?teamDiscussion=1',
			true
		],
		[
			'/sessions/consultant/sessionPreview/session/42',
			'?channel=team&at=$e',
			true
		],
		[
			'/sessions/consultant/sessionPreview',
			'?sessionId=42&teamDiscussion=1&roomId=!team42',
			true
		],
		// The main chat of the same enquiry, or another channel, is not it.
		['/sessions/consultant/sessionPreview/!main42/42', '', false],
		[
			'/sessions/consultant/sessionPreview/!main42/42',
			'?channel=supervision',
			false
		],
		[
			'/sessions/consultant/sessionPreview/!main43/43',
			'?channel=team',
			false
		],
		[
			'/sessions/consultant/sessionPreview',
			'?sessionId=43&teamDiscussion=1&roomId=!team43',
			false
		]
	])('team discussion %s%s → open=%s', (pathname, search, open) => {
		expect(
			isTeamDiscussionOpen(
				{ sessionId: '42', roomRef: '!team42' },
				pathname,
				search,
				true
			)
		).toBe(open);
		expect(
			isTeamDiscussionOpen(
				{ sessionId: '42', roomRef: '!team42' },
				pathname,
				search,
				false
			)
		).toBe(false);
	});
});
