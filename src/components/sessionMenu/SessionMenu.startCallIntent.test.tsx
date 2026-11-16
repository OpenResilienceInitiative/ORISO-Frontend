// @vitest-environment oriso-jsdom
/**
 * FE#1050 item 5: "Starten" on the overview card and "Video-Call starten" in
 * the calendar open the conversation with a one-shot request to start its
 * video call. The conversation's own call controls take it up: with the
 * checks of their own button, through the start of their own button, once.
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
import { startVideoCallState } from '../call/startCallIntent';
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
}

const Conversation = ({
	callsInMenu = false,
	userData = counsellor,
	status = 2,
	isVideoCallAllowed = true,
	isSupervisor = false,
	agencyFeaturePolicy = ready(),
	sessionId = SESSION
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
								isSession: true,
								isGroup: false,
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
const opened = (key = `entry-${++entryKey}`) => ({
	pathname: PATH,
	state: startVideoCallState(SESSION),
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
		expect(location?.state).toEqual(startVideoCallState(SESSION));

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
		expect(location?.state).toEqual(startVideoCallState(SESSION));
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
			const view = openConversation({}, opened(), (node) => (
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
			const entry = opened();
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
});
