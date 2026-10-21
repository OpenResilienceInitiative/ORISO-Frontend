// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { apiCallState } from '../../api/apiCallState';
import { apiFetchUserDrafts } from '../../api/apiUserDrafts';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';

// Third-party decorative animation requires a canvas absent from jsdom.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../api/apiCallState', () => ({ apiCallState: vi.fn() }));
vi.mock('../../api/apiUserDrafts', () => ({ apiFetchUserDrafts: vi.fn() }));

const call = {
	callId: 'existing-call',
	roomRef: '!source:example',
	callRoomId: '!media:example',
	callType: 'video' as const,
	state: 'running' as const,
	participants: []
};
const callItem: NotificationFeedItem = {
	id: 'call-1',
	type: 'info',
	eventType: 'call.started',
	category: 'system',
	title: '',
	text: '',
	createdAt: '2026-10-08T00:00:00Z',
	readAt: null,
	params: {
		roomRef: call.roomRef,
		callId: call.callId,
		callRoomId: call.callRoomId,
		callType: call.callType,
		seriesId: 42
	}
};
const joinRoom = vi.fn();
const sendEvent = vi.fn();
const createRoom = vi.fn();
const markRead = vi.fn();
const addNotification = vi.fn();
const sourceRoom = { getMyMembership: () => 'join' };
const mediaRoom = {
	getMyMembership: () => 'join',
	hasEncryptionStateEvent: () => true
};
let mediaJoined: boolean;
const client = {
	getRoom: (id: string) =>
		id === call.roomRef ? sourceRoom : mediaJoined ? mediaRoom : null,
	joinRoom,
	sendEvent,
	createRoom,
	matrixRTC: {
		getRoomSession: () => ({ memberships: [{ sender: '@other:example' }] })
	}
};

let user: ReturnType<typeof userEvent.setup>;
beforeEach(async () => {
	user = userEvent.setup();
	callManager.endCall(false);
	vi.clearAllMocks();
	mediaJoined = false;
	joinRoom.mockImplementation(async () => {
		mediaJoined = true;
		return mediaRoom;
	});
	vi.mocked(apiCallState).mockResolvedValue(call);
	vi.mocked(apiFetchUserDrafts).mockResolvedValue({
		items: [],
		page: 0,
		perPage: 200
	});
	setMatrixClientServiceRef({ getClient: () => client } as never);
});
afterEach(() => {
	cleanup();
	callManager.endCall(false);
	setMatrixClientServiceRef(null);
});

const Location = () => (
	<output aria-label="Current route">{useLocation().pathname}</output>
);
const renderCenter = async (
	width = 1400,
	item = callItem,
	sessions: unknown[] = []
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
							value={{ sessions } as never}
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

it('joins the existing call from the desktop Activity action after fresh authorization', async () => {
	await renderCenter();
	await user.click(
		screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
	);
	await waitFor(() =>
		expect(joinRoom).toHaveBeenCalledWith('!media:example')
	);
	expect(callManager.getCurrentCall()).toMatchObject({
		callId: 'existing-call',
		roomId: '!media:example',
		signalRoomId: '!source:example',
		isVideo: true,
		state: 'connecting'
	});
	expect(screen.getByLabelText('Current route').textContent).toBe(
		'/notifications'
	);
	expect(markRead).toHaveBeenCalledWith('call-1');
	expect(sendEvent).not.toHaveBeenCalled();
	expect(createRoom).not.toHaveBeenCalled();
});

it('joins the existing call from a mobile Activity card without navigating away', async () => {
	await renderCenter(390);
	await user.click(
		screen.getByRole('button', { name: /Call ongoing A call is ongoing/ })
	);
	await waitFor(() =>
		expect(joinRoom).toHaveBeenCalledWith('!media:example')
	);
	expect(screen.getByLabelText('Current route').textContent).toBe(
		'/notifications'
	);
	expect(markRead).toHaveBeenCalledWith('call-1');
	expect(sendEvent).not.toHaveBeenCalled();
	expect(createRoom).not.toHaveBeenCalled();
});

it.each(['callId', 'roomRef', 'callRoomId', 'callType'])(
	'keeps a call card with missing %s inert instead of guessing or navigating to the root',
	async (field) => {
		await renderCenter(1400, {
			...callItem,
			params: { ...callItem.params, [field]: undefined }
		});
		await user.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		await waitFor(() => expect(markRead).toHaveBeenCalledWith('call-1'));
		expect(apiCallState).not.toHaveBeenCalled();
		expect(joinRoom).not.toHaveBeenCalled();
		expect(createRoom).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Current route').textContent).toBe(
			'/notifications'
		);
	}
);

it.each(['ended', 'missed', 'denied', 'unavailable', 'identity-mismatch'])(
	'does not join when fresh authenticated state is %s',
	async (state) => {
		if (state === 'ended' || state === 'missed')
			vi.mocked(apiCallState).mockResolvedValue({ ...call, state });
		else if (state === 'denied')
			vi.mocked(apiCallState).mockResolvedValue(null);
		else if (state === 'unavailable')
			vi.mocked(apiCallState).mockRejectedValue(
				new Error('synthetic unavailable')
			);
		else
			vi.mocked(apiCallState).mockResolvedValue({
				...call,
				callId: 'other-call'
			});
		await renderCenter();
		await user.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		await waitFor(() => expect(apiCallState).toHaveBeenCalled());
		await act(() =>
			Promise.allSettled(
				vi
					.mocked(apiCallState)
					.mock.results.map((result) => result.value)
			)
		);
		expect(joinRoom).not.toHaveBeenCalled();
		expect(callManager.getCurrentCall()).toBeNull();
		// A call that is over opens its conversation; anything else stays put.
		expect(screen.getByLabelText('Current route').textContent).toBe(
			state === 'ended' || state === 'missed'
				? '/sessions/consultant/sessionView/session/42'
				: '/notifications'
		);
	}
);

it('does not join through a replacement account after a deferred state confirmation', async () => {
	let confirm!: (value: typeof call) => void;
	vi.mocked(apiCallState).mockReturnValue(
		new Promise((resolve) => {
			confirm = resolve;
		})
	);
	await renderCenter();
	const action = screen.getAllByRole('button', {
		name: 'Open chat',
		exact: true
	})[0];
	await user.click(action);
	await user.click(action);
	await waitFor(() => expect(apiCallState).toHaveBeenCalledTimes(1));
	const replacementJoin = vi.fn();
	setMatrixClientServiceRef({
		getClient: () => ({ ...client, joinRoom: replacementJoin })
	} as never);
	await act(async () => {
		confirm(call);
	});
	expect(joinRoom).not.toHaveBeenCalled();
	expect(replacementJoin).not.toHaveBeenCalled();
	expect(callManager.getCurrentCall()).toBeNull();
	expect(screen.getByLabelText('Current route').textContent).toBe(
		'/notifications'
	);
});

it('preserves the audio call type and session call mode instead of creating a video/group call', async () => {
	vi.mocked(apiCallState).mockResolvedValue({ ...call, callType: 'audio' });
	await renderCenter(1400, {
		...callItem,
		sourceSessionId: '73',
		params: {
			...callItem.params,
			callType: 'audio',
			seriesId: undefined,
			sessionId: 73
		}
	});
	await user.click(
		screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
	);
	await waitFor(() =>
		expect(joinRoom).toHaveBeenCalledWith('!media:example')
	);
	expect(callManager.getCurrentCall()).toMatchObject({
		isVideo: false,
		isGroup: false
	});
	expect(createRoom).not.toHaveBeenCalled();
});

it.each(['request.new', 'inquiry.accepted', 'draft.created'])(
	'preserves the existing authorized path action for %s',
	async (eventType) => {
		const path = '/sessions/consultant/sessionView/session/73';
		await renderCenter(1400, {
			...callItem,
			eventType,
			params: {},
			actionPath: path
		});
		await user.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		expect(screen.getByLabelText('Current route').textContent).toBe(path);
		expect(markRead).toHaveBeenCalledWith('call-1');
		expect(apiCallState).not.toHaveBeenCalled();
		expect(joinRoom).not.toHaveBeenCalled();
	}
);

it('joins as a group call when the call belongs to a group conversation, not by series', async () => {
	const join = vi.spyOn(callManager, 'joinExistingCall');
	await renderCenter(
		1400,
		{ ...callItem, params: { ...callItem.params, seriesId: undefined } },
		[{ chat: { matrixRoomId: call.roomRef } }]
	);
	await user.click(
		screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
	);
	await waitFor(() => expect(join).toHaveBeenCalled());
	expect(join.mock.calls[0][1]).toBe(true);
	join.mockRestore();
});

it('joins a one-to-one call as non-group even when the card carries a series id', async () => {
	const join = vi.spyOn(callManager, 'joinExistingCall');
	// A one-to-one conversation has no group chat entry for this room; an
	// unrelated group conversation proves the room id is compared.
	await renderCenter(1400, callItem, [
		{ session: { id: 73, groupId: null, matrixRoomId: call.roomRef } },
		{ chat: { id: 9, matrixRoomId: '!other-group:example' } }
	]);
	await user.click(
		screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
	);
	await waitFor(() => expect(join).toHaveBeenCalled());
	expect(join.mock.calls[0][1]).toBe(false);
	join.mockRestore();
});

it.each(['busy', 'unavailable'] as const)(
	'tells the user when joining from Activity is %s',
	async (outcome) => {
		const join = vi
			.spyOn(callManager, 'joinExistingCall')
			.mockResolvedValue(outcome);
		await renderCenter();
		await user.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		await waitFor(() =>
			expect(addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					text: en.videoCall.timeline.joinFailed
				})
			)
		);
		expect(screen.getByLabelText('Current route').textContent).toBe(
			'/notifications'
		);
		join.mockRestore();
	}
);

it('opens the conversation instead of an error when the call already ended', async () => {
	const join = vi
		.spyOn(callManager, 'joinExistingCall')
		.mockResolvedValue('ended');
	await renderCenter(1400, { ...callItem, sourceSessionId: '73' });
	await user.click(
		screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
	);
	await waitFor(() =>
		expect(screen.getByLabelText('Current route').textContent).toMatch(
			/\/sessionView\/.*73$/
		)
	);
	expect(addNotification).not.toHaveBeenCalled();
	join.mockRestore();
});
