import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	NotificationsContext,
	NotificationType
} from '../../globalState/provider/NotificationsProvider';
import {
	LiveChatMessageNoticeProps,
	NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE
} from './LiveChatMessageNotice';
import {
	ENQUIRY_LIST_PATH,
	NEW_ENQUIRY_NOTICE_ID,
	NewEnquiryNoticeProps,
	NOTIFICATION_TYPE_NEW_ENQUIRY
} from './NewEnquiryNotice';
import { Notifications } from './Notifications';
import {
	desktop1440Globals,
	phone375Globals,
	tablet820Globals
} from '../message/messageStoryShell';

const enquiry = (
	overrides: Partial<NewEnquiryNoticeProps> = {}
): NewEnquiryNoticeProps => ({
	id: NEW_ENQUIRY_NOTICE_ID,
	notificationType: NOTIFICATION_TYPE_NEW_ENQUIRY,
	count: 1,
	path: '/sessions/consultant/sessionPreview/!room246/246',
	...overrides
});

const liveChat: LiveChatMessageNoticeProps = {
	id: 'live-chat-message:42',
	notificationType: NOTIFICATION_TYPE_LIVE_CHAT_MESSAGE,
	sessionId: '42',
	roomRef: '!room42',
	senderName: 'Ratsuchende 4711',
	count: 1,
	path: '/sessions/consultant/sessionView/!room42/42'
};

const enquiryCards = (root: HTMLElement) =>
	root.querySelectorAll('[data-cy="new-enquiry-notice"]');

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
	id: 'components-notifications-new-enquiry-notice',
	title: 'Notifications/New enquiry pop-up',
	component: NoticeStack,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' },
		docs: {
			description: {
				component:
					'Das In-App-Pop-up für eine neue Anfrage an die Beraterin (ORISO-Frontend#1435), gebaut wie das Live-Chat-Pop-up (#1470). Es erscheint im bestehenden Hinweis-Stapel oben rechts (mobil oben über die volle Breite), in jedem Bereich außer „Anfragen“ selbst. Alle neuen Anfragen teilen sich eine Karte, die hochzählt. Bei einer Anfrage öffnet der Knopf diese Anfrage, ab zwei die Liste „Anfragen“. Die Karte bleibt, bis die Beraterin „Anfragen“ öffnet, sie schließt, oder keine Anfrage mehr offen ist. Pop-up und Ton gehorchen der Zeile „Neue Anfrage“ im Reiter „Anfragen“ der Benachrichtigungs-Einstellungen.'
			}
		}
	},
	globals: desktop1440Globals,
	args: { notices: [enquiry()] }
} satisfies Meta<typeof NoticeStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneEnquiry: Story = {
	name: 'Eine neue Anfrage',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = await canvas.findByRole('status');
		await expect(card).toHaveTextContent('Neue Anfrage');
		await expect(card).toHaveTextContent(
			'Eine ratsuchende Person wartet auf Antwort.'
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anfrage ansehen' })
		);
		await waitFor(() => expect(canvas.queryByRole('status')).toBeNull());
	}
};

export const SeveralEnquiries: Story = {
	name: 'Mehrere neue Anfragen',
	args: { notices: [enquiry({ count: 3, path: ENQUIRY_LIST_PATH })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'3 neue Anfragen warten auf Antwort.'
		);
		await expect(
			canvas.getByRole('button', { name: 'Anfragen ansehen' })
		).toBeInTheDocument();
	}
};

export const WithLiveChatMessage: Story = {
	name: 'Zusammen mit einer Live-Chat-Nachricht',
	args: {
		notices: [liveChat, enquiry({ count: 2, path: ENQUIRY_LIST_PATH })]
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(enquiryCards(canvasElement)).toHaveLength(1)
		);
		await expect(canvas.getAllByRole('status')).toHaveLength(2);
		await userEvent.click(
			canvas.getAllByRole('button', { name: 'Schließen' })[1]
		);
		await waitFor(() =>
			expect(enquiryCards(canvasElement)).toHaveLength(0)
		);
	}
};

export const Tablet: Story = {
	name: 'Tablet',
	globals: tablet820Globals,
	args: { notices: [enquiry({ count: 2, path: ENQUIRY_LIST_PATH })] }
};

export const Mobile: Story = {
	name: 'Mobil',
	globals: phone375Globals,
	args: { notices: [enquiry()] }
};
