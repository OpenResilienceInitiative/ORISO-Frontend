// @vitest-environment jsdom

import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor
} from '@testing-library/react';
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
	instances: [] as Array<{
		stop: ReturnType<typeof vi.fn>;
		transport: { send: ReturnType<typeof vi.fn> };
	}>
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

		// Awaited, not immediate: the surface now waits for the call's own
		// goodbye before its document is destroyed. See `HANGUP_HANDSHAKE_MS`.
		await waitFor(() =>
			expect(callManager.getCurrentCall()).toEqual(
				expect.objectContaining({
					callId: FAKE_CALL_ID,
					roomId: FAKE_ELEMENT_CALL_ROOM_ID,
					signalRoomId: FAKE_SIGNAL_ROOM_ID,
					isGroup: true,
					state: 'left'
				})
			)
		);
		expect(callManager.hasActiveCall()).toBe(false);

		view.unmount();

		expect(listenerCount(matrixClientService)).toBe(0);
		expect(widgetApiMocks.instances).toHaveLength(1);
		expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled();

		resetCallManager();
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('waits for the call to say goodbye before destroying its document', async () => {
		/*
		 * `hangup()` is a widget action and the MatrixRTC leave happens INSIDE
		 * the iframe, once it has processed the message. Firing it and blanking
		 * the iframe in the same tick raced that: the document went away before
		 * the membership left, so everybody else went on seeing this person in
		 * the call — and the durable card went on saying `running` — until the
		 * delayed leave expired. That net is for a browser that crashes, not
		 * for a button somebody pressed.
		 */
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
		const iframe = await waitFor(() => {
			const found = view.container.querySelector(
				'.element-call-iframe'
			) as HTMLIFrameElement | null;
			expect(found).toBeTruthy();
			return found!;
		});
		const callUrl = iframe.src;
		expect(callUrl).not.toBe('about:blank');

		// The call takes its time replying.
		let replied!: () => void;
		widgetApiMocks.instances
			.at(-1)!
			.transport.send.mockImplementation(async (action: string) => {
				if (action !== 'im.vector.hangup') return {};
				await new Promise<void>((resolve) => {
					replied = resolve;
				});
				return {};
			});

		fireEvent.click(view.getByRole('button', { name: 'Close call' }));
		await Promise.resolve();

		// Still here, and still holding the call: nothing has been torn down
		// under the iframe's feet.
		expect(iframe.src).toBe(callUrl);
		expect(callManager.hasActiveCall()).toBe(true);

		replied();
		await waitFor(() => expect(callManager.hasActiveCall()).toBe(false));
		expect(iframe.src).toBe('about:blank');
	});

	it('closes anyway when the call never answers', async () => {
		// The cap. A wedged iframe must not trap anybody in a surface that
		// will not close; past it the teardown goes ahead and the delayed
		// leave does its job after all.
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
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

			widgetApiMocks.instances
				.at(-1)!
				.transport.send.mockImplementation(async (action: string) =>
					action === 'im.vector.hangup' ? new Promise(() => {}) : {}
				);

			fireEvent.click(view.getByRole('button', { name: 'Close call' }));
			await vi.advanceTimersByTimeAsync(2000);
			expect(callManager.hasActiveCall()).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('resizes the stage from the keyboard, not only from a pointer', async () => {
		/*
		 * These handles were `role="separator"` with an `aria-label` and
		 * nothing but `onPointerDown`: they announced a control a keyboard
		 * could neither reach nor operate. On this surface that also means no
		 * way to make room for the Gesprächsnotizen panel without a mouse,
		 * since the panel moves beside the stage only past a width.
		 */
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

		const handle = view.container.querySelector(
			'.call-resize-handle--e'
		) as HTMLElement | null;
		expect(handle).toBeTruthy();
		// Reachable at all, and it says where it sits in its range.
		expect(handle!.getAttribute('tabindex')).toBe('0');
		const before = Number(handle!.getAttribute('aria-valuenow'));
		expect(before).toBeGreaterThan(0);
		expect(
			Number(handle!.getAttribute('aria-valuemin'))
		).toBeLessThanOrEqual(before);

		handle!.focus();
		expect(document.activeElement).toBe(handle);

		const widthNow = (): number =>
			Number(
				view.container
					.querySelector('.call-resize-handle--e')!
					.getAttribute('aria-valuenow')
			);

		// Inwards first: the stage opens at the width the window allows, so
		// `ArrowRight` is correctly clamped and would prove nothing.
		fireEvent.keyDown(handle!, { key: 'ArrowLeft' });
		await waitFor(() => expect(widthNow()).toBeLessThan(before));
		const narrowed = widthNow();

		// And back out again, so this is a resize rather than a one-way trip.
		fireEvent.keyDown(
			view.container.querySelector('.call-resize-handle--e')!,
			{ key: 'ArrowRight' }
		);
		await waitFor(() => expect(widthNow()).toBeGreaterThan(narrowed));

		// Shift takes bigger strides than a bare arrow.
		const fromHere = widthNow();
		fireEvent.keyDown(
			view.container.querySelector('.call-resize-handle--e')!,
			{ key: 'ArrowLeft', shiftKey: true }
		);
		await waitFor(() =>
			expect(fromHere - widthNow()).toBeGreaterThan(before - narrowed)
		);
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
		await waitFor(() =>
			expect(callManager.getCurrentCall()).toEqual(
				expect.objectContaining({
					callId: FAKE_CALL_ID,
					state: 'left',
					isGroup: true
				})
			)
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

	const counsellorWithStage = async (
		innerWidth: number,
		innerHeight: number
	) => {
		const was = {
			width: window.innerWidth,
			height: window.innerHeight
		};
		window.innerWidth = innerWidth;
		window.innerHeight = innerHeight;
		try {
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
			return view.container.querySelector('.element-call-container');
		} finally {
			// Restored even when `waitFor` rejects: the enclosing cleanup does
			// not touch the viewport, so a failure here would leak these
			// dimensions into every later render in this file.
			window.innerWidth = was.width;
			window.innerHeight = was.height;
		}
	};

	it('marks a stage too narrow to seat the notepad beside the call', async () => {
		/*
		 * The stage is a floating window, not the page.
		 *
		 * Opening the notepad made it a 320px flex sibling of the iframe, and
		 * the only thing that decided whether to do that instead of laying it
		 * over the stage was a VIEWPORT media query at 1280px. The stage's own
		 * width is `stageSize` — autofit scales it to the screen and the
		 * resize handles take it down to 280px — so a wide screen with a small
		 * stage took the side-by-side branch and squeezed the call to a sliver,
		 * or overflowed the panel out of a shell that clips.
		 *
		 * 700x300 is a desktop viewport (the mobile view starts at 640) whose
		 * autofit stage is 436px wide: too narrow for 320 + the 280px minimum
		 * the resizer allows for the call.
		 */
		const container = await counsellorWithStage(700, 300);
		expect(container?.getAttribute('data-narrow-stage')).toBe('true');
	});

	it('leaves a stage with room for both alone', async () => {
		// The other half of the test above: the marker has to be a
		// measurement and not simply always on, or it would move the panel
		// over the stage on every screen and undo the dock the handoff draws.
		const container = await counsellorWithStage(1600, 900);
		expect(container?.getAttribute('data-narrow-stage')).toBeNull();
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

	it('says it again when the same call is reopened', async () => {
		/*
		 * The gap the re-announce does NOT cover.
		 *
		 * Leaving a group call keeps the room: `leaveCall` sets the state to
		 * `left` and holds on to `currentCall`, so `callRoomId` never changes
		 * and the room-keyed `forgetPublishedIdentity` cleanup does not fire.
		 * `lastSent` therefore still held this client's identity when the
		 * surface was opened again, and the publish was a no-op.
		 *
		 * Everybody who was already in the call still has the first event, so
		 * the gap is invisible to them. Somebody who joined while this client
		 * was away does not: `history_visibility` is `joined`, so they cannot
		 * read it from the room's history, and an arrival makes the OTHERS
		 * resend their own identities rather than this one. They would go on
		 * seeing the returner as initials.
		 *
		 * Note this cannot be shown by unmounting and rendering again — the
		 * unmount runs the cleanup and clears `lastSent`, so that version
		 * passes against the unfixed code. The component stays mounted here
		 * and only the widget session changes, which is the real case.
		 */
		const service = makeFakeMatrixClientService('active');
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
		const announcements = (): number =>
			client.sendEvent.mock.calls.filter(
				(call: unknown[]) => call[1] === 'org.oriso.call.identity'
			).length;
		await waitFor(() => expect(announcements()).toBe(1));

		// Close the surface, then open it again. Same call, same room.
		await act(async () => {
			callManager.leaveCall();
		});
		await act(async () => {
			callManager.answerCall();
		});

		await waitFor(() => expect(announcements()).toBe(2));
	});

	it('says it again when somebody joins the CALL, including on a rejoin', async () => {
		/*
		 * What replaces a state event's "always current", and the signal it
		 * has to listen to.
		 *
		 * Room state is there for whoever reads it next; a timeline event
		 * reaches whoever was listening at the time, and the call room's
		 * history is closed to non-members — so a newcomer is handed nothing
		 * and everybody already in the call re-announces instead.
		 *
		 * The signal is the MatrixRTC session, not room membership. The widget
		 * host never leaves the Matrix room, so somebody who closes the call
		 * surface and reopens it stays a joined room member throughout and
		 * only their RTC membership goes away and comes back. Watching room
		 * membership never fired for them, nobody re-announced, and the
		 * returning participant sat looking at initials where the animals had
		 * been.
		 */
		const service = makeFakeMatrixClientService('active');
		const setCallMemberships = (
			service as unknown as {
				setCallMemberships(senders: string[]): void;
			}
		).setCallMemberships;
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

		// Our own membership churning is not an arrival.
		setCallMemberships([]);
		setCallMemberships([FAKE_CURRENT_USER_ID]);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);

		// Somebody else joining is.
		setCallMemberships([FAKE_CURRENT_USER_ID, '@newcomer:x.test']);
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(2));

		// Staying is not.
		setCallMemberships([FAKE_CURRENT_USER_ID, '@newcomer:x.test']);
		expect(client.sendEvent).toHaveBeenCalledTimes(2);

		// And leaving and coming back IS, which room membership could not see.
		setCallMemberships([FAKE_CURRENT_USER_ID]);
		setCallMemberships([FAKE_CURRENT_USER_ID, '@newcomer:x.test']);
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(3));
	});

	it('treats a second device of somebody already here as an arrival', async () => {
		/*
		 * MatrixRTC memberships are per device. Collapsing them to a set of
		 * user ids made a familiar face on a new device look like nothing
		 * happening — so nobody re-announced, and that device, which had
		 * received none of the identities sent before it existed, showed
		 * everybody as initials for the rest of the call.
		 */
		const service = makeFakeMatrixClientService('active');
		const harness = service as unknown as {
			setCallMemberships(
				senders: Array<string | { sender: string; deviceId?: string }>
			): void;
		};
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

		harness.setCallMemberships([
			FAKE_CURRENT_USER_ID,
			{ sender: '@newcomer:x.test', deviceId: 'LAPTOP' }
		]);
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(2));

		// The same person, a second device: still an arrival.
		harness.setCallMemberships([
			FAKE_CURRENT_USER_ID,
			{ sender: '@newcomer:x.test', deviceId: 'LAPTOP' },
			{ sender: '@newcomer:x.test', deviceId: 'PHONE' }
		]);
		await waitFor(() => expect(client.sendEvent).toHaveBeenCalledTimes(3));

		// And nothing changing is still nothing changing.
		harness.setCallMemberships([
			FAKE_CURRENT_USER_ID,
			{ sender: '@newcomer:x.test', deviceId: 'LAPTOP' },
			{ sender: '@newcomer:x.test', deviceId: 'PHONE' }
		]);
		expect(client.sendEvent).toHaveBeenCalledTimes(3);
	});

	it('keeps announcing through the client a token refresh put in place', async () => {
		/*
		 * A token refresh swaps the client inside `MatrixClientService` and
		 * takes the old client's listeners with it — but the service object,
		 * which is what the context holds and what the identity effect
		 * depends on, is the same object before and after. So the effect sat
		 * on a dead MatrixRTC listener until some unrelated render happened,
		 * and nobody arriving after the refresh was re-announced to: they saw
		 * this person as initials for the rest of the call.
		 */
		const service = makeFakeMatrixClientService('active');
		const harness = service as unknown as {
			setCallMemberships(senders: string[]): void;
			replaceClient(): { sendEvent: ReturnType<typeof vi.fn> };
		};
		const before = service.getClient() as unknown as {
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
		await waitFor(() => expect(before.sendEvent).toHaveBeenCalledTimes(1));

		const after = harness.replaceClient();

		/*
		 * The replacement says it again by itself. Waiting for an arrival to
		 * prompt it would leave anybody who arrived between the old client
		 * going away and the new one being listened to looking at initials
		 * for the rest of the call, and nothing else closes that window.
		 *
		 * How MANY times is deliberately not pinned. Swapping the client also
		 * rebuilds the widget, so its URL goes through `null` and back, and that
		 * round trip is itself a session boundary that announces — one
		 * announcement or two, depending on how the renders fall. Pinning the
		 * count made this test pass alone and fail in the full suite, which is a
		 * property of the harness and not of the host.
		 */
		await waitFor(() => expect(after.sendEvent).toHaveBeenCalled());
		const afterTheSwap = after.sendEvent.mock.calls.length;

		// And the listeners moved with it: an arrival is still an arrival.
		harness.setCallMemberships([FAKE_CURRENT_USER_ID, '@newcomer:x.test']);
		await waitFor(() =>
			expect(after.sendEvent.mock.calls.length).toBeGreaterThan(
				afterTheSwap
			)
		);

		// The dead client was not asked to send anything more.
		expect(before.sendEvent).toHaveBeenCalledTimes(1);
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
