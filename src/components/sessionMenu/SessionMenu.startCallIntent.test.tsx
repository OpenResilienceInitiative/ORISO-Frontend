// @vitest-environment oriso-jsdom
/**
 * FE#1050 items 5 and 6: "Starten" on the overview card and "Video-Call
 * starten" / "Anruf starten" in the calendar open the conversation with a
 * one-shot request to start its video or audio call. The conversation's own
 * call controls take it up: with the checks of their own button of that
 * kind, through the start of that button, once.
 */
import { canonicalAgencySettings } from '../../test/fixtures/conversationPolicyFixtures';
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	ConsultingTypesContext,
	NotificationsContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { enterPracticeMode, exitPracticeMode } from '../../practice';
import type { AgencyConversationPolicy } from '../../globalState/interfaces/ConversationFeatureSettings';
import { startRoomCall } from '../call/startRoomCall';
import { startCallState, type CallKind } from '../call/startCallIntent';
import { SessionMenu } from './SessionMenu';

vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../call/startRoomCall', () => ({
	startRoomCall: vi.fn().mockResolvedValue(undefined)
}));
const tenant = vi.hoisted(() => ({ isLoading: false }));
vi.mock('../../hooks/useSessionTenantSettings', () => ({
	useSessionTenantSettings: () => ({
		settings: {},
		isLoading: tenant.isLoading
	})
}));
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({ settings: {}, updateSettings: vi.fn() })
}));
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({ users: [] })
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: {} })
}));
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<object>()),
	apiPutArchive: vi.fn(),
	apiPutDearchive: vi.fn(),
	apiPutGroupChat: vi.fn()
}));

const SESSION = 42;
const ROOM = '!appointment:oriso';
const PATH = `/sessions/consultant/sessionView/${ROOM}/${SESSION}`;

const counsellor = {
	userId: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};
const asker = {
	userId: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
};

const ready = (
	settings = canonicalAgencySettings()
): AgencyConversationPolicy => ({ agencyId: 101, state: 'ready', settings });

let location: ReturnType<typeof useLocation> | undefined;
const LocationProbe = () => {
	location = useLocation();
	return null;
};

const addNotification = vi.fn();
let entryKey = 0;

interface Setup {
	callsInMenu?: boolean;
	userData?: object;
	status?: number;
	isVideoCallAllowed?: boolean;
	isSupervisor?: boolean;
	agencyFeaturePolicy?: AgencyConversationPolicy;
	sessionId?: number;
	isGroup?: boolean;
}

const Conversation = ({
	callsInMenu = false,
	userData = counsellor,
	status = 2,
	isVideoCallAllowed = true,
	isSupervisor = false,
	agencyFeaturePolicy = ready(),
	sessionId = SESSION,
	isGroup = false
}: Setup) => (
	<SessionTypeContext.Provider
		value={
			{
				type: SESSION_LIST_TYPES.MY_SESSION,
				path: '/sessions/consultant/sessionView'
			} as any
		}
	>
		<UserDataContext.Provider value={{ userData } as any}>
			<NotificationsContext.Provider value={{ addNotification } as any}>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: {
								isSession: !isGroup,
								isGroup,
								isEnquiry: false,
								rid: ROOM,
								consultant: { id: 'counsellor' },
								item: {
									id: sessionId,
									consultingType: 0,
									matrixRoomId: ROOM,
									active: true,
									subscribed: true,
									status,
									agencyId: 101,
									conversationType: 'AGENCY_COUNSELLING'
								}
							},
							reloadActiveSession: vi.fn(),
							agencyFeaturePolicy
						} as any
					}
				>
					<ConsultingTypesContext.Provider
						value={
							{
								consultingTypes: [{ id: 0, isVideoCallAllowed }]
							} as any
						}
					>
						<SessionsDataContext.Provider
							value={{ dispatch: vi.fn() } as any}
						>
							<SessionMenu
								hasUserInitiatedStopOrLeaveRequest={{
									current: false
								}}
								isAskerInfoAvailable
								callsInMenu={callsInMenu}
								isSupervisor={isSupervisor}
							/>
							<LocationProbe />
						</SessionsDataContext.Provider>
					</ConsultingTypesContext.Provider>
				</ActiveSessionContext.Provider>
			</NotificationsContext.Provider>
		</UserDataContext.Provider>
	</SessionTypeContext.Provider>
);

/** The conversation, opened by "Starten": one history entry with the request. */
const opened = (kind: CallKind = 'video', key = `entry-${++entryKey}`) => ({
	pathname: PATH,
	state: startCallState(SESSION, kind),
	key
});

const openConversation = (
	setup: Setup = {},
	entry = opened(),
	wrap: (node: React.ReactElement) => React.ReactElement = (node) => node
) => {
	const view = render(
		wrap(
			<MemoryRouter initialEntries={[entry]}>
				<Conversation {...setup} />
			</MemoryRouter>
		)
	);
	return {
		...view,
		update: (next: Setup) =>
			view.rerender(
				wrap(
					<MemoryRouter initialEntries={[entry]}>
						<Conversation {...setup} {...next} />
					</MemoryRouter>
				)
			)
	};
};

const setGesture = (isActive: boolean | undefined) =>
	Object.defineProperty(navigator, 'userActivation', {
		configurable: true,
		value: isActive === undefined ? undefined : { isActive }
	});

const startedCalls = () => vi.mocked(startRoomCall).mock.calls;
const headerVideoButton = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="session-header-start-video-call"]'
	);
const headerAudioButton = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="session-header-start-call"]'
	);
/** Settings with only one kind of call switched on. */
const onlyAudio = () =>
	ready(canonicalAgencySettings({ featureVideoCallsEnabled: false }));
const onlyVideo = () =>
	ready(canonicalAgencySettings({ featureAudioCallsEnabled: false }));

beforeEach(() => {
	vi.clearAllMocks();
	tenant.isLoading = false;
	location = undefined;
	setGesture(true);
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {}
	})) as any;
});
afterEach(() => {
	cleanup();
	exitPracticeMode();
	setGesture(undefined);
});

describe('SessionMenu takes up a start request (FE#1050)', () => {
	it('starts the video call once, with its own start, when its checks allow it', () => {
		openConversation();

		expect(startedCalls()).toHaveLength(1);
		expect(startedCalls()[0][0]).toMatchObject({
			roomId: ROOM,
			isVideo: true,
			isGroup: false
		});
		expect(addNotification).not.toHaveBeenCalled();
	});

	it('waits for the settings and the agency\'s answer instead of reading "loading" as a refusal', () => {
		const agencyLoading: AgencyConversationPolicy = {
			agencyId: 101,
			state: 'loading',
			settings: canonicalAgencySettings()
		};
		// The settings of the conversation are on their way.
		tenant.isLoading = true;
		const view = openConversation({ agencyFeaturePolicy: ready() });
		expect(startedCalls()).toHaveLength(0);

		// The settings are in, the agency's answer is on its way.
		tenant.isLoading = false;
		view.update({ agencyFeaturePolicy: agencyLoading });
		expect(startedCalls()).toHaveLength(0);
		expect(addNotification).not.toHaveBeenCalled();
		expect(location?.state).toEqual(startCallState(SESSION, 'video'));

		view.update({ agencyFeaturePolicy: ready() });
		expect(startedCalls()).toHaveLength(1);
	});

	it("waits while the agency's answer still belongs to the conversation before", () => {
		const view = openConversation({
			agencyFeaturePolicy: {
				agencyId: 7,
				state: 'ready',
				settings: canonicalAgencySettings()
			}
		});
		expect(startedCalls()).toHaveLength(0);
		expect(addNotification).not.toHaveBeenCalled();

		view.update({ agencyFeaturePolicy: ready() });
		expect(startedCalls()).toHaveLength(1);
	});

	it('leaves a request for another conversation alone', () => {
		openConversation({ sessionId: 7 });

		expect(startedCalls()).toHaveLength(0);
		expect(addNotification).not.toHaveBeenCalled();
		expect(location?.state).toEqual(startCallState(SESSION, 'video'));
	});

	/* FE#2482: in a group chat the group header owns the call buttons and
	   takes the request (GroupCallStartRequest). The menu must neither start
	   nor refuse it, and must leave it in the history entry for the header. */
	it("leaves a group chat's request to the group header", () => {
		openConversation({ isGroup: true });

		expect(startedCalls()).toHaveLength(0);
		expect(addNotification).not.toHaveBeenCalled();
		expect(location?.state).toEqual(startCallState(SESSION, 'video'));
	});

	describe('starts nothing when a check refuses, says so and keeps the conversation open', () => {
		it.each<[string, Setup | 'practice', boolean]>([
			[
				'the video call switch is off for this agency',
				{
					agencyFeaturePolicy: ready(
						canonicalAgencySettings({
							featureVideoCallsEnabled: false
						})
					)
				},
				true
			],
			[
				'the agency has not answered (unavailable)',
				{
					agencyFeaturePolicy: {
						agencyId: 101,
						state: 'unavailable',
						settings: canonicalAgencySettings()
					}
				},
				true
			],
			[
				'the consulting type allows no video calls',
				{ isVideoCallAllowed: false },
				true
			],
			['the person is no counsellor', { userData: asker }, false],
			['the conversation was rejected', { status: 5 }, false],
			[
				'the counsellor supervises this conversation',
				{ isSupervisor: true },
				false
			],
			['practice mode is on', 'practice', false]
		])('%s', (_gate, setup, callsDisabled) => {
			if (setup === 'practice')
				enterPracticeMode({ tourId: 'consultant-practice-accept' });

			openConversation(setup === 'practice' ? {} : setup);

			expect(startedCalls()).toHaveLength(0);
			expect(addNotification).toHaveBeenCalledTimes(1);
			expect(addNotification.mock.calls[0][0]).toMatchObject({
				title: 'videoCall.overlay.unsupported.headline',
				text: callsDisabled ? 'directLink.entry.callsDisabled' : ''
			});
			expect(location?.pathname).toBe(PATH);
			expect(location?.state).toBeNull();
		});
	});

	describe('once per request', () => {
		it('a re-render, a strict-mode double effect or new props do not start again', () => {
			const view = openConversation({}, opened('video'), (node) => (
				<React.StrictMode>{node}</React.StrictMode>
			));
			view.update({});
			view.update({ agencyFeaturePolicy: ready() });

			expect(startedCalls()).toHaveLength(1);
		});

		it('removes the request from the history entry, so a reload or a way back starts nothing', () => {
			openConversation();

			expect(startedCalls()).toHaveLength(1);
			expect(location?.pathname).toBe(PATH);
			expect(location?.state).toBeNull();
		});

		it('a remount on the same history entry does not start again', () => {
			const entry = opened('video');
			openConversation({}, entry).unmount();
			openConversation({}, entry);

			expect(startedCalls()).toHaveLength(1);
		});
	});

	describe('when the gesture of the click ran out on the way', () => {
		it.each([
			['no longer active', false],
			['unknown to the browser', undefined]
		] as const)(
			'(%s) focuses and marks the own video call button instead; its click starts',
			(_case, isActive) => {
				setGesture(isActive);
				openConversation();

				expect(startedCalls()).toHaveLength(0);
				expect(addNotification).not.toHaveBeenCalled();
				const button = headerVideoButton();
				expect(document.activeElement).toBe(button);
				expect(
					button?.closest('.sessionMenu__callOffer')
				).not.toBeNull();
				expect(location?.state).toBeNull();

				fireEvent.click(button!);
				expect(startedCalls()).toHaveLength(1);
				expect(startedCalls()[0][0]).toMatchObject({ isVideo: true });
				expect(
					document.querySelector('.sessionMenu__callOffer')
				).toBeNull();
			}
		);

		it('opens the menu with its video call row marked when the calls live in the menu', () => {
			setGesture(false);
			openConversation({ callsInMenu: true });

			expect(startedCalls()).toHaveLength(0);
			expect(
				document.querySelector('.sessionMenu__content--open')
			).not.toBeNull();
			const row = document.querySelector<HTMLButtonElement>(
				'[data-cy="session-menu-start-video-call"]'
			);
			expect(row?.classList.contains('sessionMenu__callOffer')).toBe(
				true
			);

			act(() => row!.click());
			expect(startedCalls()).toHaveLength(1);
		});
	});

	describe('an audio request ("Anruf starten", item 6)', () => {
		it("starts the audio call once, with the audio button's own start, when its checks allow it", () => {
			const view = openConversation({}, opened('audio'), (node) => (
				<React.StrictMode>{node}</React.StrictMode>
			));
			view.update({});

			expect(startedCalls()).toHaveLength(1);
			expect(startedCalls()[0][0]).toMatchObject({
				roomId: ROOM,
				isVideo: false,
				isGroup: false
			});
			expect(addNotification).not.toHaveBeenCalled();
			expect(location?.state).toBeNull();
		});

		it('a remount on the same history entry does not start it again', () => {
			const entry = opened('audio');
			openConversation({}, entry).unmount();
			openConversation({}, entry);

			expect(startedCalls()).toHaveLength(1);
		});

		it("waits for the agency's answer before it decides", () => {
			const view = openConversation(
				{
					agencyFeaturePolicy: {
						agencyId: 101,
						state: 'loading',
						settings: canonicalAgencySettings()
					}
				},
				opened('audio')
			);
			expect(startedCalls()).toHaveLength(0);
			expect(addNotification).not.toHaveBeenCalled();

			view.update({ agencyFeaturePolicy: ready() });
			expect(startedCalls()).toHaveLength(1);
			expect(startedCalls()[0][0]).toMatchObject({ isVideo: false });
		});

		describe('starts nothing when a check of the audio button refuses, says so and keeps the conversation open', () => {
			it.each<[string, Setup | 'practice']>([
				[
					'the audio call switch is off for this agency',
					{ agencyFeaturePolicy: onlyVideo() }
				],
				[
					'the agency has not answered (unavailable)',
					{
						agencyFeaturePolicy: {
							agencyId: 101,
							state: 'unavailable',
							settings: canonicalAgencySettings()
						}
					}
				],
				[
					'the consulting type allows no calls',
					{ isVideoCallAllowed: false }
				],
				['the person is no counsellor', { userData: asker }],
				['the conversation was rejected', { status: 5 }],
				[
					'the counsellor supervises this conversation',
					{ isSupervisor: true }
				],
				['practice mode is on', 'practice']
			])('%s', (_gate, setup) => {
				if (setup === 'practice')
					enterPracticeMode({ tourId: 'consultant-practice-accept' });

				openConversation(
					setup === 'practice' ? {} : setup,
					opened('audio')
				);

				expect(startedCalls()).toHaveLength(0);
				expect(addNotification).toHaveBeenCalledTimes(1);
				expect(addNotification.mock.calls[0][0]).toMatchObject({
					title: 'directLink.entry.callsDisabled',
					text: ''
				});
				expect(location?.pathname).toBe(PATH);
				expect(location?.state).toBeNull();
			});
		});

		it.each<[CallKind, () => AgencyConversationPolicy, boolean]>([
			['video', onlyVideo, true],
			['audio', onlyAudio, false]
		])(
			'the %s request starts only that kind of call',
			(kind, policy, isVideo) => {
				openConversation(
					{ agencyFeaturePolicy: policy() },
					opened(kind)
				);

				expect(startedCalls()).toHaveLength(1);
				expect(startedCalls()[0][0]).toMatchObject({ isVideo });
			}
		);

		it.each<[CallKind, () => AgencyConversationPolicy]>([
			['video', onlyAudio],
			['audio', onlyVideo]
		])(
			'the %s request, its button off, starts no call of the other kind',
			(kind, policy) => {
				openConversation(
					{ agencyFeaturePolicy: policy() },
					opened(kind)
				);

				expect(startedCalls()).toHaveLength(0);
				expect(addNotification).toHaveBeenCalledTimes(1);
			}
		);

		it('without a live gesture focuses and marks the audio button, not the video button; its click starts audio', () => {
			setGesture(false);
			openConversation({}, opened('audio'));

			expect(startedCalls()).toHaveLength(0);
			const button = headerAudioButton();
			expect(document.activeElement).toBe(button);
			expect(button?.closest('.sessionMenu__callOffer')).not.toBeNull();
			expect(
				headerVideoButton()?.closest('.sessionMenu__callOffer')
			).toBeNull();

			fireEvent.click(button!);
			expect(startedCalls()).toHaveLength(1);
			expect(startedCalls()[0][0]).toMatchObject({ isVideo: false });
		});

		it('without a live gesture opens the menu with its audio row marked when the calls live in the menu', () => {
			setGesture(false);
			openConversation({ callsInMenu: true }, opened('audio'));

			expect(
				document.querySelector('.sessionMenu__content--open')
			).not.toBeNull();
			const row = document.querySelector<HTMLButtonElement>(
				'[data-cy="session-menu-start-call"]'
			);
			expect(row?.classList.contains('sessionMenu__callOffer')).toBe(
				true
			);
			expect(
				document
					.querySelector('[data-cy="session-menu-start-video-call"]')
					?.classList.contains('sessionMenu__callOffer')
			).toBe(false);

			act(() => row!.click());
			expect(startedCalls()).toHaveLength(1);
			expect(startedCalls()[0][0]).toMatchObject({ isVideo: false });
		});
	});
});
