import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	NOTIFICATION_TYPE_INFO,
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import {
	LiveChatMessageNoticeProps,
	NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE
} from './LiveChatMessageNotice';
import { Notifications } from './Notifications';
import {
	desktop1440Globals,
	phone375Globals,
	tablet820Globals
} from '../message/messageStoryShell';

const notice = (
	sessionId: string,
	overrides: Partial<LiveChatMessageNoticeProps> = {}
): LiveChatMessageNoticeProps => ({
	id: `live-chat-message:${sessionId}`,
	notificationType: NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE,
	sessionId,
	roomRef: `!room${sessionId}`,
	senderName: 'Ratsuchende 4711',
	count: 1,
	path: `/sessions/consultant/sessionView/!room${sessionId}/${sessionId}`,
	...overrides
});

const liveChatCards = (root: HTMLElement) =>
	root.querySelectorAll('[data-cy="live-chat-message-notice"]');

/**
 * The real notification stack against a state that behaves like
 * NotificationsProvider's (remove filters the card out), so closing and
 * "Chat öffnen" act exactly as in the app.
 */
const NoticeStack = ({ notices }: { notices: NotificationType[] }) => {
	const [notifications, setNotifications] = useState(notices);
	const removeNotification = useCallback(
		(id: string | number) =>
			setNotifications((list) => list.filter((item) => item.id !== id)),
		[]
	);
	const value = useMemo(
		() =>
			({
				notifications,
				setNotifications,
				removeNotification,
				hasNotification: (id: string | number) =>
					notifications.some((item) => item.id === id)
			}) as never,
		[notifications, removeNotification]
	);
	return (
		<NotificationsContext.Provider value={value}>
			<Notifications notifications={notifications} />
		</NotificationsContext.Provider>
	);
};

const meta = {
	id: 'components-notifications-live-chat-message-notice',
	title: 'Notifications/Live chat message pop-up',
	component: NoticeStack,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' },
		docs: {
			description: {
				component:
					'Das In-App-Pop-up für eine neue Live-Chat-Nachricht an die Beraterin (ORISO-Frontend#1470). Es erscheint im bestehenden Hinweis-Stapel oben rechts (mobil oben über die volle Breite), zeigt nur den Absendernamen und nie den Nachrichtentext. Weitere Nachrichten desselben Chats zählen auf derselben Karte hoch; jeder Chat hat höchstens eine Karte. Es bleibt stehen, bis die Beraterin den Chat öffnet oder die Karte schließt, und gehorcht der Spalte „Pop-up“ der Zeile „Live-Chat-Nachricht“ in den Benachrichtigungs-Einstellungen. Den Ton spielt dieselbe Zeile.'
			}
		}
	},
	globals: desktop1440Globals,
	args: { notices: [notice('42')] }
} satisfies Meta<typeof NoticeStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneMessage: Story = {
	name: 'Eine neue Nachricht',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = await canvas.findByRole('status');
		await expect(card).toHaveTextContent('Neue Nachricht im Live-Chat');
		await expect(card).toHaveTextContent('Von Ratsuchende 4711');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Chat öffnen' })
		);
		await waitFor(() => expect(canvas.queryByRole('status')).toBeNull());
	}
};

export const SeveralMessages: Story = {
	name: 'Mehrere Nachrichten im selben Chat',
	args: { notices: [notice('42', { count: 3 })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'3 neue Nachrichten'
		);
	}
};

export const SeveralChats: Story = {
	name: 'Zwei Chats und ein anderer Hinweis',
	args: {
		notices: [
			{
				id: 'saved',
				notificationType: NOTIFICATION_TYPE_INFO,
				title: 'Gespeichert',
				text: 'Deine Änderungen wurden gespeichert.',
				closeable: true
			} as NotificationType,
			notice('42', { count: 2 }),
			notice('77', { senderName: 'Gast 0815' })
		]
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(liveChatCards(canvasElement)).toHaveLength(2)
		);
		await userEvent.click(
			canvas.getAllByRole('button', { name: 'Schließen' })[1]
		);
		await waitFor(() =>
			expect(liveChatCards(canvasElement)).toHaveLength(1)
		);
	}
};

export const LongSenderName: Story = {
	name: 'Langer Absendername',
	args: {
		notices: [
			notice('42', {
				senderName:
					'Ratsuchende mit einem sehr langen selbst gewählten Benutzernamen 2026',
				count: 12
			})
		]
	}
};

export const NoSender: Story = {
	name: 'Ohne Absendername',
	args: { notices: [notice('42', { senderName: null })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).not.toHaveTextContent(
			'Von '
		);
	}
};

export const Tablet: Story = {
	name: 'Tablet',
	globals: tablet820Globals,
	args: { notices: [notice('42', { count: 2 })] }
};

export const Mobile: Story = {
	name: 'Mobil',
	globals: phone375Globals,
	args: { notices: [notice('42', { count: 2 }), notice('77')] }
};
