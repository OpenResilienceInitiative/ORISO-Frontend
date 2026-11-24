// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';

/* The advice seeker's waiting room inside the app hands its join request back
   to the room, so the closing animation keeps the screen covered until the
   session has been reloaded (ORISO-Frontend#1737). */

const reloadActiveSession = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
	userData: {
		userName: 'asker',
		grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
	} as Record<string, unknown>,
	item: { id: 15, active: true, consultingType: 1 } as Record<string, unknown>
}));

vi.mock('../../globalState', async () => {
	const React = await import('react');
	return {
		AUTHORITIES: {
			CREATE_NEW_CHAT: 'AUTHORIZATION_CREATE_NEW_CHAT',
			ASKER_DEFAULT: 'AUTHORIZATION_USER_DEFAULT'
		},
		hasUserAuthority: (authority: string, userData: any) =>
			userData?.grantedAuthorities?.includes(authority),
		useConsultingType: () => undefined,
		SessionTypeContext: React.createContext({ path: '/sessions' }),
		UserDataContext: React.createContext({ userData: state.userData }),
		NotificationsContext: React.createContext(null),
		ActiveSessionContext: React.createContext({
			activeSession: { item: state.item },
			reloadActiveSession
		})
	};
});
vi.mock('../../api', () => ({
	apiGetGroupChatInfo: vi.fn(() => new Promise(() => undefined)),
	apiPutGroupChat: vi.fn(),
	FETCH_ERRORS: {
		NO_MATCH: 'NO_MATCH',
		USER_BANNED_FROM_CHAT: 'USER_BANNED_FROM_CHAT'
	},
	GROUP_CHAT_API: { JOIN: '/join', START: '/start' }
}));
vi.mock('../../api/apiGetChatOccurrences', () => ({
	apiGetChatOccurrences: vi.fn()
}));
vi.mock('../../hooks/useWatcher', () => ({
	useWatcher: () => [vi.fn(), vi.fn(), false]
}));
vi.mock('../../hooks/useSearchParams', () => ({
	useSearchParam: () => null
}));
vi.mock('../../hooks/useTimeoutOverlay', () => ({
	useTimeoutOverlay: () => ({ visible: false, overlay: null })
}));
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
	usePrefersReducedMotion: () => false
}));
vi.mock('../../utils/counsellingDpaNotification', () => ({
	getCounsellingDpaNotification: () => null
}));
vi.mock('../app/navigationHandler', () => ({ mobileListView: vi.fn() }));
vi.mock('../logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../overlay/Overlay', () => ({
	Overlay: () => null,
	OVERLAY_FUNCTIONS: {
		CLOSE: 'CLOSE',
		REDIRECT: 'REDIRECT',
		LOGOUT: 'LOGOUT'
	}
}));
vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { PRIMARY: 'PRIMARY', SECONDARY: 'SECONDARY' }
}));
/* The counsellor's own waiting area presses the platform's gate directly. */
const gateProps = vi.hoisted(() => ({
	value: undefined as
		| { closing?: string; onEnter?: () => unknown }
		| undefined
}));
vi.mock('../app/registrationLoader/HandoverGateButton', () => ({
	HandoverGateButton: (props: {
		closing?: string;
		onEnter?: () => unknown;
	}) => {
		gateProps.value = props;
		return null;
	}
}));
vi.mock('../sessionHeader/SessionHeaderComponent', () => ({
	SessionHeaderComponent: () => null
}));
vi.mock('./useGroupChatAuthorContent', () => ({
	useGroupChatAuthorContent: () => ({ hintMessage: '', rules: [] })
}));
vi.mock('./WaitingAreaRules', () => ({ WaitingAreaRules: () => null }));
vi.mock('./waitingClock/WaitingAreaCountdown', () => ({
	WaitingAreaCountdown: () => null,
	WaitingAreaMotionToggle: () => null
}));
vi.mock('./GroupChatCalendarMenu', () => ({
	GroupChatCalendarMenu: () => null
}));
vi.mock('./groupChatHelpers', () => ({
	getGroupChatWaitingAreaVisibility: () => ({
		showCountdown: false,
		showRules: false,
		showRulesHeadline: false
	})
}));
vi.mock('./joinChat.styles', () => ({}));
/* One `t` for every render: the view puts it into memo dependencies. */
const i18n = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => null
}));

/* What the room's onJoin hands back, as the closing animation sees it. */
const joinResult = vi.hoisted(() => ({ value: undefined as unknown }));
/* #2237: what the waiting hook was told, and its "let in" for the test. */
const admission = vi.hoisted(() => ({
	options: undefined as
		| { chatId: number; enabled: boolean; onAdmitted: () => void }
		| undefined
}));
vi.mock('./waitingAdmission/useGroupWaitingAdmission', () => ({
	useGroupWaitingAdmission: (options: {
		chatId: number;
		enabled: boolean;
		onAdmitted: () => void;
	}) => {
		admission.options = options;
		return { phase: options.enabled ? 'waiting' : 'idle' };
	}
}));
vi.mock('./entryRoom/GroupWaitingRoom', () => ({
	GroupWaitingRoom: (props: {
		onJoin: () => unknown;
		joinBlocked: boolean;
		plannedStart: Date | null;
		openBeforeStart?: boolean;
		admissionWaiting?: string;
	}) => (
		<button
			data-blocked={String(Boolean(props.joinBlocked))}
			data-planned={props.plannedStart?.toISOString()}
			data-open-before-start={String(Boolean(props.openBeforeStart))}
			data-waiting={props.admissionWaiting ?? ''}
			onClick={() => {
				joinResult.value = props.onJoin();
			}}
		>
			join
		</button>
	)
}));

const { JoinGroupChatView } = await import('./JoinGroupChatView');
const { apiPutGroupChat } = await import('../../api');
const { apiGetChatOccurrences } = await import(
	'../../api/apiGetChatOccurrences'
);
const { notifyAppointmentsChanged } = await import(
	'../sessionsList/timeline/conversationAppointments'
);
const { UserDataContext, ActiveSessionContext } = await import(
	'../../globalState'
);

describe('JoinGroupChatView — the embedded room hands its join request back', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		joinResult.value = undefined;
		state.userData = {
			userName: 'asker',
			grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
		};
		gateProps.value = undefined;
		admission.options = undefined;
		window.sessionStorage.clear();
	});
	afterEach(cleanup);

	/* #2237 (Frank, 2026-11-12): in an audio or video group the person agrees
	   while waiting and the moderator's "Reinlassen" in the call is the only
	   click: then the chat opens and the call joins by itself. */
	describe("a call group lets the waiting person in on the moderator's click", () => {
		const videoGroup = { ...state.item, active: false, modality: 'VIDEO' };
		const renderIn = (item: Record<string, unknown>) =>
			render(
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: { item },
							reloadActiveSession
						} as never
					}
				>
					<JoinGroupChatView />
				</ActiveSessionContext.Provider>
			);

		it('opens the waiting room for consent before the group starts', () => {
			renderIn(videoGroup);
			expect(screen.getByText('join').dataset.openBeforeStart).toBe(
				'true'
			);
			expect(admission.options?.enabled).toBe(false);
		});

		it('waits instead of joining once the person agreed', async () => {
			renderIn(videoGroup);
			fireEvent.click(screen.getByText('join'));
			expect(joinResult.value).toBe(false);
			expect(apiPutGroupChat).not.toHaveBeenCalled();
			await waitFor(() => expect(admission.options?.enabled).toBe(true));
			expect(admission.options?.chatId).toBe(15);
			expect(screen.getByText('join').dataset.waiting).toBe(
				'groupChat.waitingAdmission.waiting'
			);
		});

		it('joins the group and marks its call once the moderator lets the person in', async () => {
			vi.mocked(apiPutGroupChat).mockResolvedValue(undefined as never);
			renderIn({ ...videoGroup, active: true });
			fireEvent.click(screen.getByText('join'));
			await waitFor(() => expect(admission.options?.enabled).toBe(true));
			await act(async () => admission.options?.onAdmitted());
			expect(apiPutGroupChat).toHaveBeenCalledWith(15, '/join');
			expect(reloadActiveSession).toHaveBeenCalled();
			const { shouldAutoJoinCall } = await import(
				'./waitingAdmission/callAutoJoin'
			);
			expect(shouldAutoJoinCall(15)).toBe(true);
		});

		it('keeps a text group as it was: agree and join', () => {
			vi.mocked(apiPutGroupChat).mockResolvedValue(undefined as never);
			renderIn({ ...state.item, modality: 'TEXT' });
			expect(screen.getByText('join').dataset.openBeforeStart).toBe(
				'false'
			);
			fireEvent.click(screen.getByText('join'));
			expect(apiPutGroupChat).toHaveBeenCalledWith(15, '/join');
			expect(admission.options?.enabled).toBe(false);
		});
	});

	it('refreshes the waiting date when its original occurrence is cancelled', async () => {
		const start = new Date(Date.now() + 86_400_000).toISOString();
		const next = new Date(Date.now() + 8 * 86_400_000).toISOString();
		const item = {
			...state.item,
			active: false,
			startDateWithTime: start,
			chatInterval: 'WEEKLY',
			repeatCount: 2
		};
		const occurrence = (value: string, occurrenceIndex: number) => ({
			seriesId: 15,
			occurrenceIndex,
			start: value,
			originalStart: value,
			duration: 60,
			modality: 'TEXT' as const
		});
		vi.mocked(apiGetChatOccurrences)
			.mockResolvedValueOnce([occurrence(start, 0), occurrence(next, 1)])
			.mockResolvedValueOnce([occurrence(next, 1)])
			.mockRejectedValueOnce(new Error('offline'));
		render(
			<ActiveSessionContext.Provider
				value={
					{ activeSession: { item }, reloadActiveSession } as never
				}
			>
				<JoinGroupChatView />
			</ActiveSessionContext.Provider>
		);
		const waiting = screen.getByText('join');
		await waitFor(() => expect(waiting.dataset.planned).toBe(start));
		act(notifyAppointmentsChanged);
		await waitFor(() => expect(waiting.dataset.planned).toBe(next));
		// A later known schedule edit must not bring an obsolete date back offline.
		await act(async () => notifyAppointmentsChanged());
		expect(apiGetChatOccurrences).toHaveBeenCalledTimes(3);
		expect(waiting.dataset.planned).toBeUndefined();
	});

	it('holds the closing animation until the join request is done and the session has been reloaded', async () => {
		let settleRequest: () => void = () => undefined;
		let settleReload: () => void = () => undefined;
		vi.mocked(apiPutGroupChat).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					settleRequest = resolve;
				}) as never
		);
		reloadActiveSession.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					settleReload = resolve;
				})
		);

		render(<JoinGroupChatView />);
		fireEvent.click(screen.getByText('join'));

		const handed = joinResult.value as Promise<unknown>;
		expect(handed).toBeInstanceOf(Promise);
		expect(apiPutGroupChat).toHaveBeenCalledWith(15, '/join');
		let over = false;
		void handed.then(() => {
			over = true;
		});

		await act(async () => settleRequest());
		expect(reloadActiveSession).toHaveBeenCalledTimes(1);
		expect(over, 'the session is still being reloaded').toBe(false);

		await act(async () => settleReload());
		await handed;
		expect(over).toBe(true);
	});

	it("closes the counsellor's own waiting area over the chat too, and holds the red until the chat has started", async () => {
		let settleReload: () => void = () => undefined;
		vi.mocked(apiPutGroupChat).mockResolvedValue(undefined as never);
		reloadActiveSession.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					settleReload = resolve;
				})
		);

		// The contexts above hold the advice seeker; this one is the counsellor
		// who opens a room that is not active yet.
		render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							userName: 'counsellor',
							grantedAuthorities: [
								'AUTHORIZATION_CREATE_NEW_CHAT'
							]
						}
					} as never
				}
			>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: {
								item: {
									id: 15,
									active: false,
									consultingType: 1
								}
							},
							reloadActiveSession
						} as never
					}
				>
					<JoinGroupChatView />
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		);
		expect(gateProps.value?.closing).toBe('messageField');

		const handed = gateProps.value!.onEnter!() as Promise<unknown>;
		expect(apiPutGroupChat).toHaveBeenCalledWith(15, '/start');
		let over = false;
		void handed.then(() => {
			over = true;
		});
		await act(async () => undefined);
		expect(over, 'the session is still being reloaded').toBe(false);

		await act(async () => settleReload());
		await handed;
		expect(over).toBe(true);
	});

	it('tells the closing animation the person stays when the request fails', async () => {
		vi.mocked(apiPutGroupChat).mockRejectedValue(new Error('boom'));

		render(<JoinGroupChatView />);
		fireEvent.click(screen.getByText('join'));

		await expect(joinResult.value as Promise<unknown>).resolves.toBe(false);
		expect(reloadActiveSession).not.toHaveBeenCalled();
	});

	it('tells it the person stays when a banned person presses join', () => {
		render(<JoinGroupChatView bannedUsers={['asker']} />);
		fireEvent.click(screen.getByText('join'));

		expect(joinResult.value).toBe(false);
		expect(apiPutGroupChat).not.toHaveBeenCalled();
	});

	it('holds the inline join while loading and blocks a confirmed ban without a join request', async () => {
		const { apiGetGroupChatInfo } = await import('../../api');
		const reply =
			Promise.withResolvers<
				Awaited<ReturnType<typeof apiGetGroupChatInfo>>
			>();
		vi.mocked(apiGetGroupChatInfo).mockReturnValueOnce(reply.promise);
		render(
			<UserDataContext.Provider
				value={
					{
						userData: { ...state.userData, userId: 'asker-id' }
					} as never
				}
			>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: {
								item: {
									...state.item,
									matrixRoomId: '!room:oriso'
								}
							},
							reloadActiveSession
						} as never
					}
				>
					<JoinGroupChatView />
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		);
		const join = screen.getByText('join');
		expect(join.dataset.blocked).toBe('true');
		fireEvent.click(join);
		expect(apiPutGroupChat).not.toHaveBeenCalled();
		await act(async () =>
			reply.resolve({
				active: true,
				id: 15,
				matrixRoomId: '!room:oriso',
				callerBanState: 'BANNED'
			} as Awaited<ReturnType<typeof apiGetGroupChatInfo>>)
		);
		expect(join.dataset.blocked).toBe('true');
		fireEvent.click(join);
		expect(apiPutGroupChat).not.toHaveBeenCalled();
	});

	// #1923: the server answers a banned member with a reason; join stays closed.
	it('blocks joining again when the server says the person was removed', async () => {
		vi.mocked(apiPutGroupChat).mockRejectedValue(
			new Error('USER_BANNED_FROM_CHAT')
		);

		render(<JoinGroupChatView />);
		fireEvent.click(screen.getByText('join'));

		await expect(joinResult.value as Promise<unknown>).resolves.toBe(false);
		await waitFor(() =>
			expect(screen.getByText('join').dataset.blocked).toBe('true')
		);
	});
});
