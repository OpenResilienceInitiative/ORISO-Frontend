import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import {
	NotificationDefaultType,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { useLiveChatAvailabilityLossNotice } from '../app/useLiveChatAvailabilityLossNotice';
import { LiveChatAvailabilityLossReason } from '../../utils/liveChatAvailabilityStorage';
import { Notifications } from './Notifications';
import {
	desktop1440Globals,
	phone375Globals
} from '../message/messageStoryShell';

/**
 * The real loss-notice hook against a notifications state that behaves like
 * NotificationsProvider's (add skips a shown id, remove filters it out), so
 * the story shows exactly the notice NavigationBar raises.
 */
const LossNotice = ({ reason }: { reason: LiveChatAvailabilityLossReason }) => {
	useLiveChatAvailabilityLossNotice(reason);
	return null;
};

const LossNoticeHarness = ({
	reason
}: {
	reason: LiveChatAvailabilityLossReason;
}) => {
	const [notifications, setNotifications] = useState<
		NotificationDefaultType[]
	>([]);
	const addNotification = useCallback(
		(notification: NotificationDefaultType) =>
			setNotifications((list) =>
				list.some((item) => item.id === notification.id)
					? list
					: [...list, notification]
			),
		[]
	);
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
				addNotification,
				removeNotification,
				hasNotification: (id: string | number) =>
					notifications.some((item) => item.id === id)
			}) as never,
		[notifications, addNotification, removeNotification]
	);
	return (
		<NotificationsContext.Provider value={value}>
			<LossNotice reason={reason} />
			<Notifications notifications={notifications} />
		</NotificationsContext.Provider>
	);
};

const meta = {
	title: 'Components/Notifications/Live chat loss notice',
	component: LossNoticeHarness,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Der Hinweis, wenn der Client den Live-Chat selbst ausgeschaltet hat (ORISO-Frontend#1485): der Server lehnt den Heartbeat ab (403), die Anmeldung ist abgelaufen (401), der Server führt keine Verfügbarkeit mehr, oder zwei Minuten lang kam kein Heartbeat an. Er hat keinen Timeout und bleibt stehen, bis die Beraterin ihn schließt oder wieder live ist — deshalb ist das Schließen ein echter Button, per Tastatur erreichbar.'
			}
		}
	},
	globals: desktop1440Globals,
	args: { reason: 'refused' }
} satisfies Meta<typeof LossNoticeHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Refused: Story = {
	name: 'Heartbeat abgelehnt (403)',
	args: { reason: 'refused' }
};

export const SessionExpired: Story = {
	name: 'Anmeldung abgelaufen (401)',
	args: { reason: 'sessionExpired' }
};

export const LeaseLost: Story = {
	name: 'Server führt keine Verfügbarkeit mehr',
	args: { reason: 'leaseLost' }
};

export const ConnectionLost: Story = {
	name: 'Verbindung länger als die Lease unterbrochen',
	args: { reason: 'connectionLost' }
};

export const RefusedPhone: Story = {
	name: 'Heartbeat abgelehnt — Telefon',
	args: { reason: 'refused' },
	globals: phone375Globals
};

export const CloseButtonFocusedByKeyboard: Story = {
	name: 'Schließen per Tastatur fokussiert',
	args: { reason: 'refused' },
	play: async ({ canvas }) => {
		const close = await canvas.findByRole('button', { name: 'Schließen' });
		await userEvent.tab();
		await expect(close).toHaveFocus();
	}
};

export const ClosedByKeyboard: Story = {
	name: 'Per Tastatur geschlossen',
	args: { reason: 'refused' },
	play: async ({ canvas }) => {
		await canvas.findByRole('button', { name: 'Schließen' });
		await userEvent.tab();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(
				canvas.queryByText(
					'Sie sind im Live-Chat nicht mehr erreichbar'
				)
			).toBeNull()
		);
	}
};
