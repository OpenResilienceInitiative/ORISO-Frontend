// @vitest-environment oriso-jsdom

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import englishCatalogue from '../../../resources/i18n/en/common.json';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import { TopicsContext } from '../../../globalState/provider/TopicsProvider';
import { AUTHORITIES } from '../../../globalState/helpers/stateHelpers';
import { callManager } from '../../../services/CallManager';
import { setAppConfig } from '../../../utils/appConfig';
import { GroupCallWidget } from '../GroupCallWidget';
import {
	FAKE_CALL_ID,
	FAKE_CALLER_USER_ID,
	FAKE_ELEMENT_CALL_ROOM_ID,
	FAKE_SIGNAL_ROOM_ID,
	makeFakeMatrixClientService,
	resetCallManager
} from './groupCallHarness';

/*
 * FE#2233 follow-up (Dev, 16 Nov): the asking for a call's share link must
 * stop at hang-up. UserService#1662: group calls have a share link as well
 * (before, an encrypted group call had no binding and answered 404).
 */

const shareLinks = vi.hoisted(() => ({
	get: vi.fn(),
	create: vi.fn()
}));
const sessionRooms = vi.hoisted(() => ({ byRoomIds: vi.fn() }));
const widgetHandlers = vi.hoisted(
	() => new Map<string, (event: unknown) => void>()
);

vi.mock('../../../api/apiCallShareLinkKnock', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../../api/apiCallShareLinkKnock')
	>()),
	apiGetCallShareLinkKnock: shareLinks.get,
	apiSetCallShareLinkKnock: vi.fn()
}));

vi.mock('../../../api/apiCallShareLink', () => ({
	apiCreateCallShareLink: shareLinks.create,
	apiUpdateCallShareLink: vi.fn()
}));

vi.mock('../knockNotice/callKnockTransport', () => ({
	httpCallKnockTransport: {
		watchPending: () => () => undefined,
		admit: vi.fn(),
		decline: vi.fn(),
		admitAll: vi.fn()
	}
}));

vi.mock('../../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: sessionRooms.byRoomIds
}));

vi.mock('matrix-widget-api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('matrix-widget-api')>();
	return {
		...actual,
		MatrixWidgetType: { Custom: 'm.custom' },
		Widget: class {},
		ClientWidgetApi: class {
			public readonly transport = {
				reply: vi.fn(),
				send: vi.fn().mockResolvedValue({})
			};
			public readonly setViewedRoomId = vi.fn();
			public readonly updateTheme = vi.fn().mockResolvedValue({});
			public readonly feedEvent = vi.fn().mockResolvedValue(undefined);
			public readonly feedToDevice = vi.fn().mockResolvedValue(undefined);
			public readonly feedStateUpdate = vi
				.fn()
				.mockResolvedValue(undefined);
			public readonly on = vi.fn(
				(name: string, handler: (event: unknown) => void) => {
					widgetHandlers.set(name, handler);
				}
			);
			public readonly stop = vi.fn();
		}
	};
});

vi.mock('../../../resources/scripts/runtimeConfig', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../../resources/scripts/runtimeConfig')
	>()),
	getElementCallBaseUrl: () => 'https://call.storybook.test'
}));

const oneToOne = {
	sessions: [
		{
			session: { id: 344, matrixRoomId: FAKE_SIGNAL_ROOM_ID },
			user: { username: 'asker', sessionData: {} }
		}
	]
};

const groupChat = (conversationType: string) => ({
	sessions: [
		{
			chat: {
				id: 12,
				groupId: FAKE_SIGNAL_ROOM_ID,
				topic: 'Montagsrunde',
				conversationType
			}
		}
	]
});

const counsellor = {
	userData: { grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT] },
	setUserData: () => undefined,
	reloadUserData: () => undefined
};

const testI18n = createInstance();

const answerCall = (isGroup: boolean) => {
	resetCallManager();
	callManager.receiveCall(
		FAKE_ELEMENT_CALL_ROOM_ID,
		true,
		FAKE_CALL_ID,
		FAKE_CALLER_USER_ID,
		isGroup,
		FAKE_SIGNAL_ROOM_ID,
		true
	);
	callManager.answerCall();
};

const renderCall = () =>
	render(
		<I18nextProvider i18n={testI18n}>
			<UserDataContext.Provider value={counsellor as never}>
				<TopicsContext.Provider
					value={{ topics: [], refreshTopics: () => {} }}
				>
					<MatrixClientContext.Provider
						value={{
							matrixClientService:
								makeFakeMatrixClientService('active'),
							setMatrixClientService: () => {}
						}}
					>
						<GroupCallWidget />
					</MatrixClientContext.Provider>
				</TopicsContext.Provider>
			</UserDataContext.Provider>
		</I18nextProvider>
	);

/** The call has loaded and joined: the widget said `ready`. */
const joinCall = async (view: ReturnType<typeof render>) => {
	const iframe = await waitFor(() => {
		const found = view.container.querySelector(
			'.element-call-iframe'
		) as HTMLIFrameElement | null;
		expect(found?.src).toMatch(/^https:\/\/call\.storybook\.test/);
		return found!;
	});
	await waitFor(() => expect(widgetHandlers.get('ready')).toBeDefined());
	await act(async () => widgetHandlers.get('ready')!({}));
	return new URLSearchParams(new URL(iframe.src).hash.slice(2));
};

/** Element Call's own hang-up button. */
const hangUpInCall = async () => {
	const handler = widgetHandlers.get('action:im.vector.hangup');
	expect(handler).toBeDefined();
	await act(async () =>
		handler!({ preventDefault: () => undefined, detail: {} })
	);
};

const passTime = async (ms: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
};

describe('GroupCallWidget and the call share link', () => {
	beforeAll(async () => {
		await testI18n.use(initReactI18next).init({
			lng: 'en',
			fallbackLng: 'en',
			defaultNS: 'common',
			resources: { en: { common: englishCatalogue } },
			interpolation: { escapeValue: false }
		});
	});

	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		widgetHandlers.clear();
		shareLinks.get.mockReset().mockResolvedValue(null);
		shareLinks.create.mockReset().mockResolvedValue(null);
		sessionRooms.byRoomIds.mockReset();
		setAppConfig(null as never);
	});

	afterEach(() => {
		cleanup();
		callManager.endCall(false);
		vi.useRealTimers();
	});

	/*
	 * UserService#1662 (Frank, 17 Nov): group calls and Gesprächskreise offer
	 * the guest link like a 1:1 call. The server binds an encrypted group call
	 * from its creator's registration and names the creator's Beratungsstelle
	 * on the link, so the link exists now.
	 */
	it.each([
		['a team group chat', 'INTERNAL_GROUP'],
		['a Gesprächskreis', 'SELF_HELP']
	])(
		'%s keeps its share link and offers the invite link',
		async (_name, conversationType) => {
			sessionRooms.byRoomIds.mockResolvedValue(
				groupChat(conversationType)
			);
			answerCall(true);

			const fragment = await joinCall(renderCall());
			await passTime(25_000);

			expect(fragment.get('orisoInvite')).toBe('1');
			expect(shareLinks.get).toHaveBeenCalledWith({
				sourceRoomId: FAKE_SIGNAL_ROOM_ID,
				callId: FAKE_CALL_ID
			});
			expect(shareLinks.create).toHaveBeenCalledWith({
				sourceRoomId: FAKE_SIGNAL_ROOM_ID,
				callId: FAKE_CALL_ID
			});
		}
	);

	it('a 1:1 call still keeps its share link and offers the invite link', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(oneToOne);
		answerCall(false);

		const fragment = await joinCall(renderCall());
		await passTime(25_000);

		expect(fragment.get('orisoInvite')).toBe('1');
		expect(shareLinks.get).toHaveBeenCalledWith({
			sourceRoomId: FAKE_SIGNAL_ROOM_ID,
			callId: FAKE_CALL_ID
		});
		expect(shareLinks.get.mock.calls.length).toBeGreaterThanOrEqual(3);
		expect(shareLinks.create).toHaveBeenCalled();
	});

	it('a 1:1 call stops asking for its share link once the counsellor hangs up', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(oneToOne);
		answerCall(false);

		await joinCall(renderCall());
		await passTime(15_000);
		const asked = shareLinks.get.mock.calls.length;
		const created = shareLinks.create.mock.calls.length;
		expect(asked).toBeGreaterThan(0);

		await hangUpInCall();
		await passTime(60_000);

		expect(shareLinks.get.mock.calls.length).toBe(asked);
		expect(shareLinks.create.mock.calls.length).toBe(created);
	});

	it('stops asking once the call surface is closed, even before the call manager has settled', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(oneToOne);
		answerCall(false);

		await joinCall(renderCall());
		await passTime(15_000);
		const asked = shareLinks.get.mock.calls.length;
		expect(asked).toBeGreaterThan(0);

		// The leave has not reached the call manager yet (or never does):
		// the call is still `connecting` there, but this person hung up.
		const leave = vi
			.spyOn(callManager, 'leaveCall')
			.mockImplementation(() => undefined);
		await hangUpInCall();
		await passTime(60_000);
		leave.mockRestore();

		expect(shareLinks.get.mock.calls.length).toBe(asked);
	});

	/*
	 * UserService#1662 (Frank, 17 Nov): a group call a plain member or an
	 * advice seeker started has no binding and gets no link. The counsellor's
	 * client stops asking after a bounded number of tries, offers no share
	 * button and creates nothing.
	 */
	it('a group call the server cannot share stops asking and offers no link', async () => {
		shareLinks.get.mockRejectedValue(
			Object.assign(new Error('CALL_SHARE_LINK_NO_CALL'), {
				callNotShareable: true
			})
		);
		shareLinks.create.mockResolvedValue(null);
		sessionRooms.byRoomIds.mockResolvedValue(groupChat('INTERNAL_GROUP'));
		answerCall(true);

		const view = renderCall();
		await joinCall(view);
		await passTime(70_000);
		const asked = shareLinks.get.mock.calls.length;
		const created = shareLinks.create.mock.calls.length;
		expect(asked).toBe(6);

		await passTime(5 * 60_000);

		expect(shareLinks.get.mock.calls.length).toBe(asked);
		expect(shareLinks.create.mock.calls.length).toBe(created);
		expect(view.container.querySelector('.element-call-share')).toBeNull();
	});

	it('a group call stops asking for its share link once the counsellor hangs up', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(groupChat('INTERNAL_GROUP'));
		answerCall(true);

		await joinCall(renderCall());
		await passTime(15_000);
		const asked = shareLinks.get.mock.calls.length;
		const created = shareLinks.create.mock.calls.length;
		expect(asked).toBeGreaterThan(0);

		await hangUpInCall();
		await passTime(60_000);

		expect(callManager.getCurrentCall()?.state).toBe('left');
		expect(shareLinks.get.mock.calls.length).toBe(asked);
		expect(shareLinks.create.mock.calls.length).toBe(created);
	});
});
