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
import { TopicsContext } from '../../../globalState/provider/TopicsProvider';
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

const sessionRooms = vi.hoisted(() => ({ byRoomIds: vi.fn() }));

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
			public readonly on = vi.fn();
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

const debt = {
	id: 7,
	name: 'Schuldnerberatung',
	slug: 'debt',
	internalIdentifier: '',
	description: '',
	titles: { short: '', long: '', registrationDropdown: '', welcome: '' }
};

const oneToOne = {
	sessions: [
		{
			session: {
				id: 344,
				matrixRoomId: FAKE_SIGNAL_ROOM_ID,
				mainTopicId: 7
			},
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
			<TopicsContext.Provider
				value={{ topics: [debt as never], refreshTopics: () => {} }}
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
		</I18nextProvider>
	);

const iframeOf = (view: ReturnType<typeof render>) =>
	view.container.querySelector(
		'.element-call-iframe'
	) as HTMLIFrameElement | null;

const callFragment = async (
	view: ReturnType<typeof render>,
	timeout?: number
) => {
	const iframe = await waitFor(
		() => {
			const found = iframeOf(view);
			expect(found?.src).toMatch(/^https:\/\/call\.storybook\.test/);
			return found!;
		},
		timeout ? { timeout } : undefined
	);
	return new URLSearchParams(new URL(iframe.src).hash.slice(2));
};

// FE#2233 checkpoint 4: the call learns the app's language, its kind and,
// for a 1:1 call, the conversation's topic.
describe('GroupCallWidget tells the call its conversation', () => {
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
		sessionRooms.byRoomIds.mockReset();
		setAppConfig(null as never);
	});

	afterEach(() => {
		cleanup();
		callManager.endCall(false);
	});

	it('a 1:1 call: single, its topic in the app language, and the app language', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(oneToOne);
		answerCall(false);

		const fragment = await callFragment(renderCall());

		expect(fragment.get('orisoCallType')).toBe('single');
		expect(fragment.get('orisoTopic')).toBe('Debt');
		expect(fragment.get('lang')).toBe('en');
	});

	it('a Gesprächskreis starts as a circle, without a topic', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(groupChat('SELF_HELP'));
		answerCall(true);

		const fragment = await callFragment(renderCall());

		expect(fragment.get('orisoCallType')).toBe('circle');
		expect(fragment.has('orisoTopic')).toBe(false);
	});

	it('a team group chat starts as a group', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(groupChat('INTERNAL_GROUP'));
		answerCall(true);

		const fragment = await callFragment(renderCall());

		expect(fragment.get('orisoCallType')).toBe('group');
		expect(fragment.has('orisoTopic')).toBe(false);
	});

	it('builds the address only once the conversation has answered', async () => {
		let answer: (value: unknown) => void = () => undefined;
		sessionRooms.byRoomIds.mockReturnValue(
			new Promise((resolve) => {
				answer = resolve;
			})
		);
		answerCall(true);

		const view = renderCall();
		await waitFor(() => expect(sessionRooms.byRoomIds).toHaveBeenCalled());
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(iframeOf(view)?.src ?? '').not.toMatch(/call\.storybook\.test/);

		await act(async () => answer(groupChat('SELF_HELP')));

		expect((await callFragment(view)).get('orisoCallType')).toBe('circle');
	});

	it('starts without the conversation when the lookup fails', async () => {
		sessionRooms.byRoomIds.mockRejectedValue(new Error('userservice down'));
		answerCall(true);

		const fragment = await callFragment(renderCall());

		expect(fragment.get('orisoCallType')).toBe('group');
		expect(fragment.get('lang')).toBe('en');
	});

	it('does not wait for an unanswered lookup for ever', async () => {
		sessionRooms.byRoomIds.mockReturnValue(new Promise(() => undefined));
		answerCall(false);

		const fragment = await callFragment(renderCall(), 4000);

		expect(fragment.get('orisoCallType')).toBe('single');
		expect(fragment.has('orisoTopic')).toBe(false);
	});
});
