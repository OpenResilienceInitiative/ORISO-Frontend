// @vitest-environment jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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

beforeEach(async () => {
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
const renderCenter = async (width = 1400, item = callItem) => {
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
							value={{ sessions: [] } as never}
						>
							<NotificationsContext.Provider
								value={
									{
										notificationFeed: [item],
										markNotificationAsRead: markRead,
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
	fireEvent.click(
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
	fireEvent.click(
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
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		await act(async () => {});
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
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		await waitFor(() => expect(apiCallState).toHaveBeenCalled());
		await act(async () => {});
		expect(joinRoom).not.toHaveBeenCalled();
		expect(callManager.getCurrentCall()).toBeNull();
		expect(screen.getByLabelText('Current route').textContent).toBe(
			'/notifications'
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
	fireEvent.click(action);
	fireEvent.click(action);
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
	fireEvent.click(
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
		fireEvent.click(
			screen.getAllByRole('button', { name: 'Open chat', exact: true })[0]
		);
		expect(screen.getByLabelText('Current route').textContent).toBe(path);
		expect(markRead).toHaveBeenCalledWith('call-1');
		expect(apiCallState).not.toHaveBeenCalled();
		expect(joinRoom).not.toHaveBeenCalled();
	}
);
