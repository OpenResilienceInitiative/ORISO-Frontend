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
	EventNoticeKind,
	EventNoticeProps,
	NOTIFICATION_TYPE_EVENT_NOTICE
} from './EventNotice';
import { Notifications } from './Notifications';
import {
	desktop1440Globals,
	phone375Globals,
	tablet820Globals
} from '../message/messageStoryShell';

const notice = (
	kind: EventNoticeKind,
	sessionId: string,
	overrides: Partial<EventNoticeProps> = {}
): EventNoticeProps => ({
	id: `event-notice:${kind}:${sessionId}`,
	notificationType: NOTIFICATION_TYPE_EVENT_NOTICE,
	kind,
	sessionId,
	roomRef: `!room${sessionId}`,
	actorName:
		kind === 'mention'
			? 'Kollegin Weber'
			: kind === 'handover'
				? 'Kollege Braun'
				: null,
	count: 1,
	path:
		kind === 'consent'
			? `/sessions/user/view/session/${sessionId}?caseHandoverRequestId=7`
			: kind === 'mention'
				? `/sessions/consultant/sessionPreview?sessionId=${sessionId}&teamDiscussion=1&roomId=!team${sessionId}`
				: `/sessions/consultant/sessionView/session/${sessionId}?caseHandoverRequestId=7`,
	...overrides
});

const cards = (root: HTMLElement) =>
	root.querySelectorAll('[data-cy$="-notice"]');

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
	id: 'components-notifications-event-notice',
	title: 'Notifications/Mention and handover pop-up',
	component: NoticeStack,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' },
		docs: {
			description: {
				component:
					'Das In-App-Pop-up für eine Erwähnung in der Team-Besprechung, ein Fallangebot an die Beraterin und für eine Übergabe, die auf die Zustimmung der ratsuchenden Person wartet (ORISO-Frontend#779). Es erscheint im bestehenden Hinweis-Stapel oben rechts (mobil oben über die volle Breite), zeigt höchstens den Namen der handelnden Person (bei der Zustimmung niemanden: Grund und Beratungsperson bleiben intern) und nie den Nachrichtentext. Weitere Ereignisse derselben Art im selben Gespräch zählen auf derselben Karte hoch; je Gespräch und Art gibt es höchstens eine Karte. Die Karte bleibt stehen, bis die Beraterin das Gespräch öffnet oder sie schließt, und gehorcht der Spalte „Pop-up“ der Zeile „Erwähnung“ bzw. „Übergabe“. Normale Nachrichten bekommen keine Karte. Ist das Ziel schon offen und sichtbar, bleibt alles still.'
			}
		}
	},
	globals: desktop1440Globals,
	args: { notices: [notice('mention', '42')] }
} satisfies Meta<typeof NoticeStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mention: Story = {
	name: 'Erwähnung',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = await canvas.findByRole('status');
		await expect(card).toHaveTextContent(
			'Erwähnung in der Team-Besprechung'
		);
		await expect(card).toHaveTextContent('Von Kollegin Weber');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Team-Besprechung öffnen' })
		);
		await waitFor(() => expect(canvas.queryByRole('status')).toBeNull());
	}
};

export const Handover: Story = {
	name: 'Fall übergeben',
	args: { notices: [notice('handover', '42')] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = await canvas.findByRole('status');
		await expect(card).toHaveTextContent('Neue Fallübergabe');
		await expect(card).toHaveTextContent('Von Kollege Braun');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Fall ansehen' })
		);
		await waitFor(() => expect(canvas.queryByRole('status')).toBeNull());
	}
};

export const SeveralMentions: Story = {
	name: 'Mehrere Erwähnungen im selben Gespräch',
	args: { notices: [notice('mention', '42', { count: 3 })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'3 neue Erwähnungen'
		);
	}
};

export const SeveralHandovers: Story = {
	name: 'Mehrere Hinweise zur Fallübergabe',
	args: { notices: [notice('handover', '42', { count: 2 })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'2 Hinweise zur Fallübergabe'
		);
	}
};

export const SeveralCards: Story = {
	name: 'Zwei Gespräche, beide Arten und ein anderer Hinweis',
	args: {
		notices: [
			{
				id: 'saved',
				notificationType: NOTIFICATION_TYPE_INFO,
				title: 'Gespeichert',
				text: 'Deine Änderungen wurden gespeichert.',
				closeable: true
			} as NotificationType,
			notice('mention', '42', { count: 2 }),
			notice('mention', '77'),
			notice('handover', '42')
		]
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(cards(canvasElement)).toHaveLength(3));
		await userEvent.click(
			canvas.getAllByRole('button', { name: 'Schließen' })[1]
		);
		await waitFor(() => expect(cards(canvasElement)).toHaveLength(2));
	}
};

export const LongName: Story = {
	name: 'Langer Name',
	args: {
		notices: [
			notice('handover', '42', {
				actorName:
					'Beraterin mit einem sehr langen Doppelnamen und Titel Dr. Mustermann-Musterfrau',
				count: 12
			})
		]
	}
};

export const NoName: Story = {
	name: 'Ohne Namen',
	args: { notices: [notice('mention', '42', { actorName: null })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).not.toHaveTextContent(
			'Von '
		);
	}
};

export const ConsentNeeded: Story = {
	name: 'Zustimmung zur Fallübergabe nötig (Ratsuchende)',
	args: { notices: [notice('consent', '42')] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = await canvas.findByRole('status');
		await expect(card).toHaveTextContent(
			'Zustimmung zur Fallübergabe nötig'
		);
		await expect(card).toHaveTextContent(
			'Die Übergabe wartet auf eine Antwort.'
		);
		await expect(card).not.toHaveTextContent('Von ');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anfrage ansehen' })
		);
		await waitFor(() => expect(canvas.queryByRole('status')).toBeNull());
	}
};

export const SeveralConsentRequests: Story = {
	name: 'Mehrere Zustimmungsanfragen',
	args: { notices: [notice('consent', '42', { count: 2 })] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('status')).toHaveTextContent(
			'2 Anfragen zur Fallübergabe warten auf eine Antwort.'
		);
	}
};

export const ConsentMobile: Story = {
	name: 'Zustimmung, mobil',
	globals: phone375Globals,
	args: { notices: [notice('consent', '42')] }
};

export const Tablet: Story = {
	name: 'Tablet',
	globals: tablet820Globals,
	args: {
		notices: [
			notice('mention', '42', { count: 2 }),
			notice('handover', '42')
		]
	}
};

export const Mobile: Story = {
	name: 'Mobil',
	globals: phone375Globals,
	args: {
		notices: [
			notice('mention', '42', { count: 2 }),
			notice('handover', '77')
		]
	}
};
