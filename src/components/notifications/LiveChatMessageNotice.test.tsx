// @vitest-environment oriso-jsdom
/**
 * FE#1470 — the in-app pop-up for a new live-chat message: what it says, where
 * "Open chat" leads, and when it goes away.
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
	isLiveChatOpen,
	LiveChatMessageNotice,
	LiveChatMessageNoticeProps,
	NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE,
	upsertLiveChatMessageNotice
} from './LiveChatMessageNotice';

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
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null
}));

const notice = (
	overrides: Partial<LiveChatMessageNoticeProps> = {}
): LiveChatMessageNoticeProps => ({
	id: 'live-chat-message:42',
	notificationType: NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE,
	sessionId: '42',
	roomRef: '!room42',
	senderName: 'Seeker 7',
	count: 1,
	path: '/sessions/consultant/sessionView/!room42/42',
	...overrides
});

const Where = () => <div data-cy="where">{useLocation().pathname}</div>;
const GoTo = ({ to }: { to: string }) => {
	const navigate = useNavigate();
	return <button onClick={() => navigate(to)}>go</button>;
};

const renderNotice = (props: LiveChatMessageNoticeProps, start = '/') => {
	const removeNotification = vi.fn();
	render(
		<MemoryRouter initialEntries={[start]}>
			<NotificationsContext.Provider
				value={{ removeNotification } as never}
			>
				<LiveChatMessageNotice {...props} />
				<Where />
				<GoTo to="/sessions/consultant/sessionView/!room42/42" />
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
	return removeNotification;
};

describe('LiveChatMessageNotice', () => {
	afterEach(cleanup);

	it('names the sender, never message text, and opens the chat', () => {
		const remove = renderNotice(
			notice(),
			'/sessions/consultant/sessionView'
		);
		expect(screen.getByRole('status').textContent).toContain(
			'notification.liveChatMessage.title'
		);
		expect(screen.getByRole('status').textContent).toContain('Seeker 7');
		expect(screen.queryByTestId('live-chat-message-count')).toBeNull();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'notification.liveChatMessage.open'
			})
		);
		expect(screen.getByTestId('where').textContent).toBe(
			'/sessions/consultant/sessionView/!room42/42'
		);
		expect(remove).toHaveBeenCalledWith(
			'live-chat-message:42',
			NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE
		);
	});

	it('shows the count for several messages and closes by keyboard-reachable button', () => {
		const remove = renderNotice(notice({ count: 3 }));
		expect(screen.getByTestId('live-chat-message-count').textContent).toBe(
			'notification.liveChatMessage.several:{"count":3}'
		);
		fireEvent.click(screen.getByRole('button', { name: 'app.close' }));
		expect(remove).toHaveBeenCalledTimes(1);
	});

	it('goes away once the chat is opened another way', () => {
		const remove = renderNotice(notice());
		expect(remove).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('go'));
		expect(remove).toHaveBeenCalledWith(
			'live-chat-message:42',
			NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE
		);
	});

	it('offers no open button without a target', () => {
		renderNotice(notice({ path: null }));
		expect(screen.queryByTestId('live-chat-message-open')).toBeNull();
	});
});

describe('live-chat pop-up rules', () => {
	const event = {
		eventType: 'message.new',
		sourceSessionId: '42',
		params: { roomRef: '!room42' }
	};

	it.each([
		['/sessions/consultant/sessionView/!room42/42', true, true],
		['/sessions/consultant/sessionView/!room42/42?tab=x', true, true],
		['/sessions/consultant/sessionView/session/42', true, true],
		['/sessions/consultant/sessionView/!room42/42', false, false],
		['/sessions/consultant/sessionView/!room43/43', true, false],
		['/sessions/consultant/sessionView/!room4/142', true, false],
		['/sessions/consultant/sessionPreview/!room42/42', true, false]
	])('%s visible=%s → open=%s', (pathname, visible, open) => {
		expect(isLiveChatOpen(event, pathname, visible)).toBe(open);
	});

	it('counts on the shown card instead of stacking a second one', () => {
		const other = { id: 'x', notificationType: 'info' as const };
		const first = upsertLiveChatMessageNotice([other], notice());
		const second = upsertLiveChatMessageNotice(first, notice());
		expect(second).toHaveLength(2);
		expect((second[1] as LiveChatMessageNoticeProps).count).toBe(2);
		expect(second[0]).toBe(other);
	});
});
