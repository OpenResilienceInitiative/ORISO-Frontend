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

const renderNotice = (props: EventNoticeProps, start = '/') => {
	const removeNotification = vi.fn();
	render(
		<MemoryRouter initialEntries={[start]}>
			<NotificationsContext.Provider
				value={{ removeNotification } as never}
			>
				<EventNotice {...props} />
				<Where />
				<GoTo to="/sessions/consultant/sessionView/!room42/42" />
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

	it('goes away once the conversation is opened another way', () => {
		const remove = renderNotice(notice());
		expect(remove).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('go'));
		expect(remove).toHaveBeenCalledWith(
			'event-notice:mention:42',
			NOTIFICATION_TYPE_EVENT_NOTICE
		);
	});

	it('waits in a hidden tab even with the conversation route open, and settles on return', () => {
		let state: DocumentVisibilityState = 'hidden';
		vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
			() => state
		);
		const remove = renderNotice(
			notice(),
			'/sessions/consultant/sessionView/!room42/42'
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
	const row = (
		eventType: string,
		params: Record<string, unknown> = {},
		actionPath = '/sessions/consultant/sessionView/!room42/42'
	) => ({
		eventType,
		sourceSessionId: '42',
		actionPath,
		params: { recipientRole: 'consultant', ...params }
	});

	it.each([
		[row('message.new', { mentioned: true }), 'mention'],
		[row('case.handover.offer.received'), 'handover'],
		[row('handover.requested'), 'handover'],
		[row('case.handover.granted'), 'handover'],
		// No role on the row: the counsellor link decides.
		[row('handover.requested', { recipientRole: null }), 'handover'],
		[row('message.new', { mentioned: false }), null],
		[row('message.new'), null],
		[
			row('message.new', {
				mentioned: true,
				conversationType: 'LIVE_CHAT'
			}),
			null
		],
		[row('message.new', { mentioned: true, recipientRole: 'user' }), null],
		[row('handover.denied'), null],
		[row('handover.partial'), null],
		[row('request.new'), null],
		[
			row(
				'handover.requested',
				{ recipientRole: null },
				'/sessions/user/sessionView/!room42/42'
			),
			null
		],
		[
			{ ...row('message.new', { mentioned: true }), sourceSessionId: '' },
			null
		]
	])('%j → %s', (event, kind) => {
		expect(eventNoticeKindFor(event)).toBe(kind);
	});

	it('takes the sender for a mention and the initiator for a handover', () => {
		const params = { senderName: 'Sender', initiatorName: 'Initiator' };
		expect(eventNoticeActor('mention', row('message.new', params))).toBe(
			'Sender'
		);
		expect(
			eventNoticeActor('handover', row('handover.requested', params))
		).toBe('Initiator');
		expect(
			eventNoticeActor(
				'handover',
				row('handover.requested', { senderName: 'Sender' })
			)
		).toBe('Sender');
		expect(eventNoticeActor('mention', row('message.new'))).toBeNull();
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
