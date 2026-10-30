// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Context as ResponsiveContext } from 'react-responsive';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../../resources/i18n/en/common.json';
import { NotificationsCenter } from './NotificationsCenter';
import {
	NotificationsContext,
	SessionsDataContext,
	UserDataContext
} from '../../globalState';
import { callManager } from '../../services/CallManager';
import { apiCallState } from '../../api/apiCallState';
import { startRoomCall } from '../call/startRoomCall';
import { apiFetchUserDrafts } from '../../api/apiUserDrafts';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';

// Third-party decorative animation requires a canvas absent from jsdom.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../api/apiCallState', () => ({ apiCallState: vi.fn() }));
vi.mock('../../api/apiUserDrafts', () => ({ apiFetchUserDrafts: vi.fn() }));
// The conversation's own call button path; the test only asks where it is sent.
vi.mock('../call/startRoomCall', () => ({
	startRoomCall: vi.fn().mockResolvedValue(undefined)
}));

/**
 * FE#1952 (Frank, 2026-10-30): a click on the knock entry takes the
 * counsellor straight into the call of that conversation, through the same
 * start path as the conversation's call button, and shows the conversation.
 */
const conversationPath =
	'/sessions/consultant/sessionView/!direct:matrix.example/500';
const knockItem: NotificationFeedItem = {
	id: 'knock-1',
	type: 'info',
	eventType: 'call.knock.requested',
	category: 'system',
	title: '',
	text: '',
	createdAt: '2026-10-30T00:00:00Z',
	readAt: null,
	actionPath: conversationPath,
	params: {
		conversationType: 'AGENCY_COUNSELLING',
		sessionId: 500,
		roomRef: '!direct:matrix.example',
		medium: 'VIDEO'
	}
} as NotificationFeedItem;
const markRead = vi.fn();
const addNotification = vi.fn();

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
	user = userEvent.setup();
	vi.clearAllMocks();
	vi.mocked(startRoomCall).mockResolvedValue(undefined);
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const Location = () => (
	<output aria-label="Current route">{useLocation().pathname}</output>
);
const renderCenter = async (
	width = 1400,
	item = knockItem,
	sessions: unknown[] = [],
	ready = true
) => {
	const i18n = i18next.createInstance();
	await i18n.init({
		lng: 'en',
		fallbackLng: 'en',
		resources: { en: { translation: en } },
		interpolation: { escapeValue: false }
	});
	return render(
		<I18nextProvider i18n={i18n}>
			<ResponsiveContext.Provider value={{ width }}>
				<MemoryRouter initialEntries={['/notifications']}>
					<UserDataContext.Provider
						value={
							{
								userData: {
									userId: 'consultant',
									grantedAuthorities: [
										'AUTHORIZATION_CONSULTANT_DEFAULT'
									]
								}
							} as never
						}
					>
						<SessionsDataContext.Provider
							value={{ sessions, ready } as never}
						>
							<NotificationsContext.Provider
								value={
									{
										notificationFeed: [item],
										markNotificationAsRead: markRead,
										addNotification,
										refreshNotificationFeed: vi.fn(),
										markAllNotificationsAsRead: vi.fn(),
										loadOlderNotifications: vi.fn(),
										hasOlderNotifications: false
									} as never
								}
							>
								<NotificationsCenter />
								<Location />
							</NotificationsContext.Provider>
						</SessionsDataContext.Provider>
					</UserDataContext.Provider>
				</MemoryRouter>
			</ResponsiveContext.Provider>
		</I18nextProvider>
	);
};

it('starts the video call of the conversation from the desktop "Join" action and shows the conversation', async () => {
	await renderCenter();
	await user.click(
		screen.getAllByRole('button', { name: 'Join', exact: true })[0]
	);

	await waitFor(() => expect(startRoomCall).toHaveBeenCalledTimes(1));
	expect(startRoomCall).toHaveBeenCalledWith({
		roomId: '!direct:matrix.example',
		isVideo: true,
		isGroup: false
	});
	expect(markRead).toHaveBeenCalledWith('knock-1');
	expect(screen.getByLabelText('Current route').textContent).toBe(
		conversationPath
	);
	expect(apiCallState).not.toHaveBeenCalled();
});

it('names the action "Join", never "Open chat": the click goes into the call', async () => {
	await renderCenter();
	expect(
		screen.queryAllByRole('button', { name: 'Open chat', exact: true })
	).toHaveLength(0);
	expect(
		screen.getAllByRole('button', { name: 'Join', exact: true }).length
	).toBeGreaterThan(0);
});

it('starts the call from the desktop card itself: one click, no second step', async () => {
	await renderCenter();
	await user.click(screen.getAllByRole('button', { name: /knocking/i })[0]);

	await waitFor(() => expect(startRoomCall).toHaveBeenCalledTimes(1));
	expect(screen.getByLabelText('Current route').textContent).toBe(
		conversationPath
	);
});

it('starts the audio call from a mobile card with one tap', async () => {
	await renderCenter(390, {
		...knockItem,
		params: { ...knockItem.params, medium: 'AUDIO' }
	});
	await user.click(screen.getByRole('button', { name: /knocking/i }));

	await waitFor(() =>
		expect(startRoomCall).toHaveBeenCalledWith({
			roomId: '!direct:matrix.example',
			isVideo: false,
			isGroup: false
		})
	);
	expect(screen.getByLabelText('Current route').textContent).toBe(
		conversationPath
	);
});

it('does not end a call the counsellor is in elsewhere: it opens the conversation', async () => {
	vi.spyOn(callManager, 'getCurrentCall').mockReturnValue({
		roomId: '!other-call:matrix.example',
		signalRoomId: '!other:matrix.example',
		state: 'connected'
	} as never);
	await renderCenter();
	await user.click(
		screen.getAllByRole('button', { name: 'Join', exact: true })[0]
	);

	await waitFor(() =>
		expect(screen.getByLabelText('Current route').textContent).toBe(
			conversationPath
		)
	);
	expect(startRoomCall).not.toHaveBeenCalled();
});
