// @vitest-environment jsdom

import React from 'react';
import { RoomStateEvent } from 'matrix-js-sdk';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest';

import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import englishCatalogue from '../../../resources/i18n/en/common.json';

import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { UserDataContext } from '../../../globalState';
import { callManager } from '../../../services/CallManager';
import { GroupCallWidget } from '../GroupCallWidget';
import {
	FAKE_CALL_ID,
	FAKE_CURRENT_USER_ID,
	FAKE_ELEMENT_CALL_ROOM_ID,
	FAKE_SIGNAL_ROOM_ID,
	GroupCallStoryHarness,
	makeFakeMatrixClientService,
	resetCallManager,
	seedIncomingElementCall
} from './groupCallHarness';

const widgetApiMocks = vi.hoisted(() => ({
	instances: [] as Array<{ stop: ReturnType<typeof vi.fn> }>
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

			public constructor() {
				widgetApiMocks.instances.push(this);
			}
		}
	};
});

vi.mock('../../../resources/scripts/runtimeConfig', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../../resources/scripts/runtimeConfig')
	>()),
	getElementCallBaseUrl: () => 'https://call.storybook.test'
}));

const testI18n = createInstance();
const renderTranslated = (ui: React.ReactElement) =>
	render(ui, {
		wrapper: ({ children }) => (
			<I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
		)
	});

describe('GroupCallWidget Storybook harness', () => {
	const listenerCount = (matrixClientService: unknown) =>
		(
			matrixClientService as {
				getHarnessListenerCount(): number;
			}
		).getHarnessListenerCount();

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
		widgetApiMocks.instances.length = 0;
		resetCallManager();
	});

	afterEach(() => {
		cleanup();
		callManager.endCall(false);
	});

	it('leaves locally, tears down listeners and widget API, then clears retained metadata', async () => {
		const matrixClientService = makeFakeMatrixClientService('active');
		seedIncomingElementCall();
		callManager.answerCall();

		const view = renderTranslated(
			<MatrixClientContext.Provider
				value={{
					matrixClientService,
					setMatrixClientService: () => {}
				}}
			>
				<GroupCallWidget />
			</MatrixClientContext.Provider>
		);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		expect(listenerCount(matrixClientService)).toBe(4);

		fireEvent.click(view.getByRole('button', { name: 'Close call' }));

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: FAKE_CALL_ID,
				roomId: FAKE_ELEMENT_CALL_ROOM_ID,
				signalRoomId: FAKE_SIGNAL_ROOM_ID,
				isGroup: true,
				state: 'left'
			})
		);
		expect(callManager.hasActiveCall()).toBe(false);

		view.unmount();

		expect(listenerCount(matrixClientService)).toBe(0);
		expect(widgetApiMocks.instances).toHaveLength(1);
		expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled();

		resetCallManager();
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('moves all subscriptions to a fresh client and cleans up on unmount', async () => {
		const firstService = makeFakeMatrixClientService('active');
		const nextService = makeFakeMatrixClientService('connecting');
		seedIncomingElementCall();
		callManager.answerCall();

		const renderWidget = (matrixClientService: typeof firstService) => (
			<MatrixClientContext.Provider
				value={{
					matrixClientService,
					setMatrixClientService: () => {}
				}}
			>
				<GroupCallWidget />
			</MatrixClientContext.Provider>
		);
		const view = renderTranslated(renderWidget(firstService));

		await waitFor(() => {
			expect(listenerCount(firstService)).toBe(4);
			expect(widgetApiMocks.instances).toHaveLength(1);
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		view.rerender(renderWidget(nextService));
		await waitFor(() => {
			expect(listenerCount(firstService)).toBe(0);
			expect(listenerCount(nextService)).toBe(4);
		});
		await waitFor(() =>
			expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled()
		);

		view.unmount();

		expect(listenerCount(nextService)).toBe(0);
		resetCallManager();
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('clears retained local-leave metadata when the actual harness unmounts', async () => {
		const view = renderTranslated(<GroupCallStoryHarness mode="active" />);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		fireEvent.click(view.getByRole('button', { name: 'Close call' }));
		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: FAKE_CALL_ID,
				state: 'left',
				isGroup: true
			})
		);

		view.unmount();

		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('reseeds the actual harness without carrying active UI across modes', async () => {
		const view = renderTranslated(<GroupCallStoryHarness mode="active" />);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		view.rerender(<GroupCallStoryHarness mode="connecting" />);
		await waitFor(() => {
			expect(
				view.container.querySelector('.connecting-popup')
			).toBeTruthy();
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeFalsy();
		});
		await waitFor(() =>
			expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled()
		);

		view.unmount();
		expect(callManager.getCurrentCall()).toBeNull();
	});
});

describe('what the host adds around the call', () => {
	beforeEach(() => {
		resetCallManager();
		widgetApiMocks.instances.length = 0;
	});
	afterEach(() => {
		resetCallManager();
		cleanup();
	});

	const withUser = (
		userData: Record<string, unknown> | null,
		matrixClientService: unknown
	) =>
		render(
			<I18nextProvider i18n={testI18n}>
				<UserDataContext.Provider
					value={
						userData === null
							? null
							: ({
									userData,
									setUserData: () => {},
									reloadUserData: () => {}
								} as never)
					}
				>
					<MatrixClientContext.Provider
						value={
							{
								matrixClientService,
								setMatrixClientService: () => {}
							} as never
						}
					>
						<GroupCallWidget />
					</MatrixClientContext.Provider>
				</UserDataContext.Provider>
			</I18nextProvider>
		);

	const activeCall = () => {
		seedIncomingElementCall();
		callManager.answerCall();
	};

	it('gives a counsellor the private notepad beside the stage', async () => {
		const service = makeFakeMatrixClientService('active');
		activeCall();
		const view = withUser(
			{
				userId: '@berater:matrix.storybook.test',
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			},
			service
		);
		await waitFor(() =>
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy()
		);
		expect(
			view.container.querySelector('.element-call-notes')
		).toBeTruthy();
	});

	it('never offers the notepad to an advice seeker', async () => {
		// The panel is a counsellor's scratchpad. Offering it to a seeker
		// would suggest the centre keeps notes on them, in a product whose
		// whole promise is that it does not.
		const service = makeFakeMatrixClientService('active');
		activeCall();
		const view = withUser(
			{
				userId: '@suchende:matrix.storybook.test',
				grantedAuthorities: []
			},
			service
		);
		await waitFor(() =>
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy()
		);
		expect(view.container.querySelector('.element-call-notes')).toBeFalsy();
	});

	it('announces the own identity to the call room, in the timeline', async () => {
		/*
		 * Not into room state, which is the point.
		 *
		 * Matrix room encryption covers message events; state events travel
		 * in the clear in an encrypted room exactly as in any other, so an
		 * identity in state is a durable record the homeserver and every
		 * server it federates to can read — here, which advice seeker chose
		 * which animal. As a timeline event in a Megolm room the server
		 * stores ciphertext.
		 */
		const service = makeFakeMatrixClientService('active');
		const client = service.getClient() as unknown as {
			sendEvent: ReturnType<typeof vi.fn>;
			sendStateEvent: ReturnType<typeof vi.fn>;
		};
		activeCall();
		withUser(
			{
				userId: '@suchende:matrix.storybook.test',
				grantedAuthorities: []
			},
			service
		);
		await waitFor(() =>
			expect(client.sendEvent).toHaveBeenCalledWith(
				FAKE_ELEMENT_CALL_ROOM_ID,
				'org.oriso.call.identity',
				expect.objectContaining({ kind: 'animal' })
			)
		);
		// And never as room state again.
		expect(client.sendStateEvent).not.toHaveBeenCalled();
	});

	it('says it again when somebody new joins, and not otherwise', async () => {
		/*
		 * What replaces a state event's "always current".
		 *
		 * Room state is there for whoever reads it next; a timeline event
		 * reaches whoever was listening at the time. The widget is fed live
		 * events and the call room's history is closed to non-members, so a
		 * newcomer is handed nothing — everybody already in the call
		 * re-announces instead.
		 */
		const service = makeFakeMatrixClientService('active');
		const emit = (
			service as unknown as {
				emitHarnessEvent(name: string, ...args: unknown[]): void;
			}
		).emitHarnessEvent;
		const client = service.getClient() as unknown as {
			sendEvent: ReturnType<typeof vi.fn>;
		};
		activeCall();
		withUser(
			{
				userId: '@suchende:matrix.storybook.test',
				grantedAuthorities: []
			},
			service
		);
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(1));

		const member = (userId: string, membership: string) => [
			{},
			{},
			{ roomId: FAKE_ELEMENT_CALL_ROOM_ID, userId, membership }
		];

		// Somebody leaving is not an arrival.
		emit(RoomStateEvent.Members, ...member('@gone:x.test', 'leave'));
		// Nor is our own join echoing back.
		emit(RoomStateEvent.Members, ...member(FAKE_CURRENT_USER_ID, 'join'));
		// Nor is a membership event in another room.
		emit(
			RoomStateEvent.Members,
			{},
			{},
			{
				roomId: '!elsewhere:x.test',
				userId: '@other:x.test',
				membership: 'join'
			}
		);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);

		// An arrival is.
		emit(RoomStateEvent.Members, ...member('@newcomer:x.test', 'join'));
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(2));

		// And it is said once per newcomer, not once per event about them.
		emit(RoomStateEvent.Members, ...member('@newcomer:x.test', 'join'));
		expect(client.sendEvent).toHaveBeenCalledTimes(2);
	});

	it('says nothing when there is no user data to say it from', async () => {
		const service = makeFakeMatrixClientService('active');
		const client = service.getClient() as unknown as {
			sendEvent: ReturnType<typeof vi.fn>;
		};
		activeCall();
		withUser(null, service);
		await waitFor(() =>
			expect(widgetApiMocks.instances.length).toBeGreaterThan(0)
		);
		expect(client.sendEvent).not.toHaveBeenCalled();
	});
});
