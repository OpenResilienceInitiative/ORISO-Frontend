import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	TopicsContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	SessionItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE,
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionHeaderComponent } from './SessionHeaderComponent';
import { GroupChatHeader } from './GroupChatHeader';
import { buildStageMatrixClientService } from '../chatStage/__storybook__/ChatStageProviders';
import {
	desktop1440Globals,
	phone390Globals,
	tablet834Globals
} from '../message/messageStoryShell';
import './sessionHeader.styles.scss';

const APP_ORISO_CHAT_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1131-44172&t=7scG0mpt60RDLUqB-4';
const ROOM_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

/* ------------------------------------------------------------------ *
 * Shared fixtures
 * ------------------------------------------------------------------ */

const storyTopic: TopicsDataInterface = {
	id: 1,
	name: 'Familienberatung',
	slug: 'familienberatung',
	description: 'Storybook fixture topic.',
	internalIdentifier: 'familienberatung',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Familie',
		long: 'Familienberatung',
		registrationDropdown: 'Familienberatung',
		welcome: 'Familienberatung'
	}
};

const storyConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: '1-1 Beratung',
		short: '1-1',
		long: '1-1 Beratung',
		welcome: 'Willkommen',
		registrationDropdown: '1-1 Beratung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: {
		isGroupChat: false,
		groupChatRules: ['']
	},
	description: 'Storybook fixture for the chatroom header.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
};

// Consultant viewer. `userId` matches the session consultant id below so the
// header does not treat the current user as a read-only supervisor (which would
// otherwise suppress the interactive "+").
const CONSULTANT_ID = 'consultant-storybook';
const storyUserData = {
	userId: CONSULTANT_ID,
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	userRoles: ['CONSULTANT'],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

// FE#1115: the request stage is seen by the advice seeker; with no `consultant`
// yet, the header shows the search indicator instead of an avatar.
const storyAskerUserData = {
	...storyUserData,
	userId: 'asker-4401',
	userName: 'ruhiges-yak-kim@example.invalid',
	displayName: 'Ruhiges Yak Kim',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	userRoles: ['USER']
} as any;

/* ------------------------------------------------------------------ *
 * Matrix client mock (GroupChatHeader reads members from the client)
 * ------------------------------------------------------------------ */

type MockMember = { userId: string; name: string };

const makeMembers = (count: number): MockMember[] =>
	Array.from({ length: count }, (_, index) => ({
		userId: `@mitglied${index + 1}:matrix.storybook.test`,
		name: `Mitglied ${index + 1}`
	}));

// The chat-stage stand-in implements the client surface the header and
// SessionMenu touch (`on`/`removeListener`/`getAccountData`/`setAccountData`,
// room members, live timeline) — the earlier minimal mock threw in the
// browser and kept three stories on `!test`.
const makeMatrixClientService = (
	members: MockMember[],
	lastActivity: Record<string, number> = {}
) => buildStageMatrixClientService({}, members, lastActivity);

/* ------------------------------------------------------------------ *
 * Session presets (one factory per Figma condition)
 * ------------------------------------------------------------------ */

const buildSingleSession = (
	status: typeof STATUS_ACTIVE | typeof STATUS_EMPTY | typeof STATUS_ENQUIRY
): ExtendedSessionInterface =>
	buildExtendedSession(
		{
			user: {
				username: 'ruhiges-yak-kim@example.invalid',
				displayName: 'Ruhiges Yak Kim',
				sessionData: {}
			},
			consultant: {
				consultantId: CONSULTANT_ID,
				id: CONSULTANT_ID,
				username: 'beraterin@example.invalid',
				displayName: 'Beraterin ORISO',
				absent: false,
				absenceMessage: ''
			},
			language: 'de',
			session: {
				id: 4401,
				agencyId: 101,
				askerMatrixUserId: 'asker-4401',
				attachment: null,
				consultingType: 1,
				matrixRoomId: 'sb-single-room-4401',
				e2eLastMessage: null,
				lastMessage: 'Anfrage gesendet',
				messageDate: 1773822900,
				createDate: '2026-03-18T06:15:00.000Z',
				messagesRead: true,
				postcode: 12345,
				registrationType: REGISTRATION_TYPE_REGISTERED,
				status,
				videoCallMessageDTO: null,
				topic: {
					id: 1,
					name: 'Familienberatung',
					description: ''
				}
			} as unknown as SessionItemInterface
		} as ListItemInterface,
		''
	);

const buildGroupSession = (): ExtendedSessionInterface =>
	buildExtendedSession(
		{
			consultant: {
				consultantId: CONSULTANT_ID,
				id: CONSULTANT_ID,
				username: 'beraterin@example.invalid',
				displayName: 'Beraterin ORISO',
				absent: false,
				absenceMessage: ''
			},
			language: 'de',
			chat: {
				active: true,
				assignedAgencies: [],
				attachment: null,
				consultingType: 1,
				duration: 60,
				matrixRoomId: 'sb-group-room-9001',
				hintMessage: '',
				id: 9001,
				lastMessage: 'Willkommen im Team-Austausch.',
				e2eLastMessage: null,
				messageDate: 1773822900,
				messagesRead: true,
				moderators: [],
				repetitive: false,
				startDate: '2026-03-18',
				startTime: '10:00',
				subscribed: true,
				topic: 'Team Austausch',
				createdAt: '2026-03-18T06:15:00.000Z'
			} as unknown as GroupChatItemInterface
		} as ListItemInterface,
		''
	);

// 1. Group, ≤4 members (design shows individual member avatars).
export const mockGroupSessionSmall = () => ({
	session: buildGroupSession(),
	members: makeMembers(4)
});

// 2. Group, >4 members (design shows a "+N" overflow badge).
export const mockGroupSessionLarge = () => ({
	session: buildGroupSession(),
	members: makeMembers(27)
});

// 3. Active 1-on-1 (nearby / vicinity, AGENCY_COUNSELLING) → house + add.
export const mockActiveConversation = () => ({
	session: buildSingleSession(STATUS_ACTIVE)
});

// 4. Waiting room (empty enquiry) — design pairs the clock glyph with an add button.
export const mockWaitingRoomWithAdd = () => ({
	session: buildSingleSession(STATUS_EMPTY)
});

// 5. Inquiry (non-empty enquiry) — design pairs the "C" glyph with an add button.
export const mockInquiryWithAdd = () => ({
	session: buildSingleSession(STATUS_ENQUIRY)
});

// 6. Waiting room, no add.
export const mockWaitingRoom = () => ({
	session: buildSingleSession(STATUS_EMPTY)
});

// 7. Inquiry, no add.
export const mockInquiry = () => ({
	session: buildSingleSession(STATUS_ENQUIRY)
});

/* ------------------------------------------------------------------ *
 * Providers shared by every story
 * ------------------------------------------------------------------ */

const headerShell: React.CSSProperties = {
	maxWidth: 720,
	margin: '0 auto',
	background: '#fff'
};

/**
 * ADR-002 silent membership: the header shows only the asker, the assigned
 * consultant and the active supervisors — every other room member is a
 * silent agency colleague and stays hidden. The supervisors endpoint is
 * therefore what makes Bettina, Kim, Ali and Jo visible in the 1:1 stories;
 * their Matrix ids are `@<username>:…` like the real homeserver.
 */
const storySessionSupervisors = ['bettina.b', 'kim', 'ali', 'jo'].map(
	(username, index) => ({
		id: index + 1,
		sessionId: 4401,
		supervisorConsultantId: `consultant-${username}`,
		supervisorUsername: `${username}@example.invalid`,
		addedByConsultantId: CONSULTANT_ID,
		addedDate: '2026-03-18T07:00:00.000Z'
	})
);

const jsonResponse = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});

// Installed during render (useState initializer): the header fires its
// supervisor fetch from a child effect, which runs before this parent's
// effects — an effect-installed mock would always be one render too late.
const installHeaderFetchMocks = () => {
	const previousFetch = window.fetch;
	window.fetch = async (input, init) => {
		const url =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input.url;
		if (/\/sessions\/4401\/supervisors$/.test(url.split('?')[0])) {
			return jsonResponse(storySessionSupervisors);
		}
		if (url.split('?')[0].endsWith('/service/users/consultants')) {
			return jsonResponse([]);
		}
		return previousFetch(input, init);
	};
	return () => {
		window.fetch = previousFetch;
	};
};

const StoryProviders = ({
	session,
	members = [],
	lastActivity,
	userData = storyUserData,
	children
}: {
	session: ExtendedSessionInterface;
	members?: MockMember[];
	lastActivity?: Record<string, number>;
	userData?: typeof storyUserData;
	children: React.ReactNode;
}) => {
	React.useLayoutEffect(() => installHeaderFetchMocks(), []);
	const matrixClientService = React.useMemo(
		() => makeMatrixClientService(members, lastActivity),
		[members, lastActivity]
	);

	return (
		<div style={headerShell}>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<ConsultingTypesContext.Provider
						value={{
							consultingTypes: [storyConsultingType],
							setConsultingTypes: () => {}
						}}
					>
						<TopicsContext.Provider
							value={{
								topics: [storyTopic],
								refreshTopics: () => {}
							}}
						>
							<SessionsDataContext.Provider
								value={{
									ready: true,
									sessions: [],
									dispatch: () => {}
								}}
							>
								<E2EEContext.Provider
									value={{
										key: '',
										reloadPrivateKey: () => {},
										isE2eeEnabled: false,
										e2EEReady: true
									}}
								>
									<ConsultantListContext.Provider
										value={{
											consultantList: [],
											setConsultantList: () => {}
										}}
									>
										<ServerSettingsContext.Provider
											value={{
												settings: [],
												settingsReady: true,
												getSetting: () => null
											}}
										>
											<MatrixClientContext.Provider
												value={{
													matrixClientService,
													setMatrixClientService:
														() => {}
												}}
											>
												<ActiveSessionContext.Provider
													value={{
														activeSession: session,
														reloadActiveSession:
															() => {},
														readActiveSession:
															() => {}
													}}
												>
													{children}
												</ActiveSessionContext.Provider>
											</MatrixClientContext.Provider>
										</ServerSettingsContext.Provider>
									</ConsultantListContext.Provider>
								</E2EEContext.Provider>
							</SessionsDataContext.Provider>
						</TopicsContext.Provider>
					</ConsultingTypesContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</div>
	);
};

const noopRef = { current: false };

const renderGroupHeader = (preset: {
	session: ExtendedSessionInterface;
	members?: MockMember[];
}) => (
	<StoryProviders session={preset.session} members={preset.members}>
		<GroupChatHeader
			hasUserInitiatedStopOrLeaveRequest={noopRef}
			isJoinGroupChatView={false}
			bannedUsers={[]}
		/>
	</StoryProviders>
);

const renderSessionHeader = (
	preset: {
		session: ExtendedSessionInterface;
		members?: MockMember[];
		lastActivity?: Record<string, number>;
		userData?: typeof storyUserData;
	},
	showAddButton?: boolean
) => (
	<StoryProviders
		session={preset.session}
		members={preset.members}
		lastActivity={preset.lastActivity}
		userData={preset.userData}
	>
		<SessionHeaderComponent
			bannedUsers={[]}
			showAddButton={showAddButton}
		/>
	</StoryProviders>
);

// T4: the 1-on-1 room's participants (client · counsellor · supervisor).
const ASKER_MATRIX_ID = 'asker-4401';
const roomParticipants: MockMember[] = [
	{ userId: ASKER_MATRIX_ID, name: 'ruhiges_yak_kim' },
	{ userId: '@beraterin:matrix.storybook.test', name: 'Beraterin ORISO' },
	{ userId: '@bettina.b:matrix.storybook.test', name: 'Bettina B.' },
	// ADR-002: silent agency colleagues are room members but never shown.
	{ userId: '@silent.simpson:matrix.storybook.test', name: 'Silent Simpson' },
	{ userId: '@stumm.meier:matrix.storybook.test', name: 'Stumm Meier' }
];

// 8. Active 1-on-1 with the room's participants in the header avatar row.
export const mockActiveConversationWithParticipants = () => ({
	session: buildSingleSession(STATUS_ACTIVE),
	members: roomParticipants,
	// The supervisor wrote last → first in the stack (FE#1193 Job 1).
	lastActivity: {
		[ASKER_MATRIX_ID]: 100,
		'@beraterin:matrix.storybook.test': 200,
		'@bettina.b:matrix.storybook.test': 300
	}
});

// 9. Six visible participants (asker, consultant, four supervisors) → four
// avatars + "+2" (FE#1193 Job 2); the silent members never count.
export const mockActiveConversationManyParticipants = () => ({
	session: buildSingleSession(STATUS_ACTIVE),
	members: [
		...roomParticipants,
		{ userId: '@kim:matrix.storybook.test', name: 'Kim G.' },
		{ userId: '@ali:matrix.storybook.test', name: 'Ali R.' },
		{ userId: '@jo:matrix.storybook.test', name: 'Jo L.' }
	]
});

/** `consultant` is deliberately absent: that puts `ConsultantSearchLoader` into the stack. */
const buildSearchingSession = (
	status: typeof STATUS_ENQUIRY | typeof STATUS_EMPTY = STATUS_ENQUIRY
): ExtendedSessionInterface =>
	buildExtendedSession(
		{
			user: {
				username: 'ruhiges-yak-kim@example.invalid',
				displayName: 'Ruhiges Yak Kim',
				sessionData: {}
			},
			language: 'de',
			session: {
				id: 4401,
				agencyId: 101,
				askerMatrixUserId: ASKER_MATRIX_ID,
				attachment: null,
				consultingType: 1,
				matrixRoomId: 'sb-single-room-4401',
				e2eLastMessage: null,
				lastMessage: 'Anfrage gesendet',
				messageDate: 1773822900,
				createDate: '2026-03-18T06:15:00.000Z',
				messagesRead: true,
				postcode: 12345,
				registrationType: REGISTRATION_TYPE_REGISTERED,
				status,
				videoCallMessageDTO: null,
				topic: {
					id: 1,
					name: 'Familienberatung',
					description: ''
				}
			} as unknown as SessionItemInterface
		} as ListItemInterface,
		''
	);

// 10. Request stage seen by the advice seeker — the search indicator.
export const mockRequestStageSearching = () => ({
	session: buildSearchingSession(),
	members: [{ userId: ASKER_MATRIX_ID, name: 'ruhiges_yak_kim' }],
	userData: storyAskerUserData
});

// 10b. The asker's own empty enquiry: no counsellor, but nothing is searched for (#1418).
export const mockAskerEmptyEnquiry = () => ({
	session: buildSearchingSession(STATUS_EMPTY),
	members: [{ userId: ASKER_MATRIX_ID, name: 'ruhiges_yak_kim' }],
	userData: storyAskerUserData
});

// 11. A counsellor accepted: the real avatar takes the indicator's place.
export const mockRequestStageAccepted = () => ({
	session: buildSingleSession(STATUS_ACTIVE),
	members: roomParticipants,
	userData: storyAskerUserData
});

// Asserts the "+" add pill is present and rendered to the LEFT of the type
// glyph (Figma #430 layout order).
const expectAddButtonLeftOfType = async (canvasElement: HTMLElement) => {
	await waitFor(() => {
		const add = canvasElement.querySelector(
			'.chatroomMainInteractionIcon__add'
		);
		const type = canvasElement.querySelector(
			'.chatroomMainInteractionIcon__type'
		);
		expect(add).toBeTruthy();
		expect(type).toBeTruthy();
		// eslint-disable-next-line no-bitwise
		const addIsBeforeType =
			add!.compareDocumentPosition(type!) &
			Node.DOCUMENT_POSITION_FOLLOWING;
		expect(addIsBeforeType).toBeTruthy();
	});
};

/**
 * The title ends in an ellipsis before the action group — it is never
 * painted over by the call buttons (stage v3 review, 05.09.).
 */
const expectTitleClearOfActions = async (canvasElement: HTMLElement) => {
	const title = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__username h3'
	)!;
	const actions = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__headerWrapper > .sessionMenu__wrapper'
	)!;
	await expect(title).not.toBeNull();
	await expect(actions).not.toBeNull();
	const titleRect = title.getBoundingClientRect();
	const actionsRect = actions.getBoundingClientRect();
	await expect(titleRect.right).toBeLessThanOrEqual(actionsRect.left + 0.5);
	await expect(getComputedStyle(title).textOverflow).toBe('ellipsis');
	return { titleRect, actionsRect };
};

/* ------------------------------------------------------------------ *
 * Meta + stories
 * ------------------------------------------------------------------ */

const meta = {
	title: 'Components/Session/SessionHeader',
	tags: ['autodocs'],
	// The `mock*` factories are exported presets, not stories — keep them out
	// of the Storybook sidebar.
	excludeStories: /^mock.*/,
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: '/sessions/consultant/sessionView/session/4401'
		},
		design: [
			{
				type: 'figma',
				name: 'Chatroom header conditions',
				url: APP_ORISO_CHAT_HEADER_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Room Header All (1320:38281)',
				url: ROOM_HEADER_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Chatroom left header across the seven Figma conditions. Group stories render `GroupChatHeader`; the 1-on-1 stories render `SessionHeaderComponent`. TODO notes flag where the current implementation diverges from the Figma design.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Group chat with ≤4 members.
 * Expected (Figma #430): every member avatar is shown (no cap), no overflow badge.
 * TODO: keep verifying against Figma until Fix 1 (GroupChatHeader member logic)
 * is merged — the ≤4 branch now renders all avatars instead of the old 3-cap.
 */
export const GroupChatSmall: Story = {
	render: () => renderGroupHeader(mockGroupSessionSmall())
};

/**
 * Group chat with >4 members (27 here).
 * Expected (#1193 Job 2, Figma #430 cap): four overlapping avatars, then a
 * "+23" chip for the participants that do not fit.
 */
export const GroupChatLarge: Story = {
	render: () => renderGroupHeader(mockGroupSessionLarge()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const badge = canvasElement.querySelector(
				'.sessionInfo__memberCount'
			);
			expect(badge).toBeTruthy();
			expect(
				canvasElement.querySelector('.sessionInfo__memberCountNumber')
					?.textContent
			).toContain('+23');
			// Four stacked avatars, the remaining 23 collapse into the chip.
			expect(
				canvasElement.querySelectorAll('.sessionInfo__memberBubble')
					.length
			).toBe(4);
		});
	}
};

/**
 * Active 1-on-1 conversation (nearby / vicinity, AGENCY_COUNSELLING).
 * Expected (Figma): house icon + add button + the contact's avatar (animal,
 * FE#1193 Job 4) — no Matrix members yet, so the stack falls back to the contact.
 */
export const ActiveConversation: Story = {
	render: () => renderSessionHeader(mockActiveConversation()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(1);
			// T8: no "•••" next to the topic tag.
			expect(
				canvasElement.querySelector('.sessionInfo__topicDots')
			).toBeNull();
			expect(canvasElement.textContent).not.toContain('•••');
		});
	}
};

/**
 * T4 / Figma 1320:38281: the room's participants as the avatar row —
 * animal for the advice seeker, monograms for the counsellors, 28 px step,
 * latest activity first, hover / focus shows the display name (#1209: the
 * asker's anonymous id, identical to the title).
 */
export const ActiveConversationParticipants: Story = {
	name: 'Active conversation — participant avatar row (T4)',
	render: () => renderSessionHeader(mockActiveConversationWithParticipants()),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		let avatars: NodeListOf<HTMLElement>;
		await waitFor(() => {
			avatars = canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy="participant-avatar"]'
			);
			expect(avatars).toHaveLength(3);
		});
		// Latest activity first: the supervisor wrote last.
		await expect(avatars![0].getAttribute('data-user-id')).toBe(
			'@bettina.b:matrix.storybook.test'
		);
		// T14/T17 — measured in Figma 1320:38281 (get_metadata): 40 px
		// avatars, 28 px step, the group starts 8 px inside the type pill
		// and the title text follows 6 px after the group.
		const first = avatars![0].getBoundingClientRect();
		const second = avatars![1].getBoundingClientRect();
		await expect(Math.round(first.width)).toBe(40);
		await expect(Math.round(first.height)).toBe(40);
		await expect(Math.round(second.left - first.left)).toBe(28);
		const pill = canvasElement
			.querySelector('.chatroomMainInteractionIcon')!
			.getBoundingClientRect();
		const stack = canvasElement
			.querySelector('[data-cy="session-header-participants"]')!
			.getBoundingClientRect();
		await expect(Math.round(pill.right - stack.left)).toBe(8);
		const title = canvasElement
			.querySelector('.sessionInfo__username h3')!
			.getBoundingClientRect();
		await expect(Math.round(title.left - stack.right)).toBe(6);
		// Hover shows the name; the asker's tooltip is exactly what the
		// header title shows (#1209: one identity, list = header = tooltip).
		const headerTitle =
			canvasElement.querySelector('h3')?.textContent ?? '';
		await expect(headerTitle.length).toBeGreaterThan(0);
		const askerAvatar = canvasElement.querySelector<HTMLElement>(
			`[data-user-id="${ASKER_MATRIX_ID}"]`
		)!;
		await userEvent.hover(askerAvatar);
		await waitFor(() =>
			expect(
				canvas.getByText(headerTitle, {
					selector: '[data-cy="participant-tooltip"]'
				})
			).toBeVisible()
		);
		// … and it is not clipped by the header row (T4 self-check).
		const tip = canvas.getByText(headerTitle, {
			selector: '[data-cy="participant-tooltip"]'
		});
		const tipRect = tip.getBoundingClientRect();
		const rowRect = canvasElement
			.querySelector('.sessionInfo__username')!
			.getBoundingClientRect();
		await expect(tipRect.top).toBeGreaterThan(rowRect.bottom - 1);
		// No clipping ancestor cuts it off (the tooltip is pointer-events:
		// none, so elementFromPoint cannot be used here).
		let ancestor = tip.parentElement;
		while (ancestor && ancestor !== canvasElement) {
			if (getComputedStyle(ancestor).overflow !== 'visible') {
				const box = ancestor.getBoundingClientRect();
				await expect(tipRect.top).toBeGreaterThanOrEqual(box.top);
				await expect(tipRect.bottom).toBeLessThanOrEqual(box.bottom);
			}
			ancestor = ancestor.parentElement;
		}
		// T3/T43: the hairline sits at 16 + 2 + 40 + 6 = 64 px from the
		// header top (T43: row padding-top 2 — Frank deviates from Figma's 6
		// by 4 px); the row's box (incl. the 1 px hairline) ends at 65.
		const header = canvasElement.querySelector('.sessionInfo')!;
		const row = canvasElement.querySelector('.sessionInfo__headerWrapper')!;
		await expect(
			Math.round(
				row.getBoundingClientRect().bottom -
					header.getBoundingClientRect().top
			)
		).toBe(65);
		await expectTitleClearOfActions(canvasElement);
	}
};

/** FE#1193 Job 2: beyond four participants the tail folds into "+N". */
export const ActiveConversationManyParticipants: Story = {
	name: 'Active conversation — six participants, "+2"',
	render: () => renderSessionHeader(mockActiveConversationManyParticipants()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(4);
			expect(
				canvasElement.querySelector('[data-cy="participant-overflow"]')
					?.textContent
			).toBe('+2');
		});
		// The "+2" chip sits in the flow, before the title — never over it.
		const chip = canvasElement
			.querySelector('[data-cy="participant-overflow"]')!
			.getBoundingClientRect();
		const title = canvasElement
			.querySelector('.sessionInfo__username h3')!
			.getBoundingClientRect();
		await expect(chip.right).toBeLessThanOrEqual(title.left + 0.5);
		await expectTitleClearOfActions(canvasElement);
	}
};

/**
 * Phone (390 px): back button, type pill and the inline call buttons take
 * 236 of the 358 px row before any avatar, so the stack is capped at one
 * avatar + a compact "+N" and the title keeps ≥ 40 % of the width it shares
 * with the stack — and still ends before the actions. Whether the call
 * buttons move into the kebab on the phone is Frank's call (stage v3 review).
 */
export const ActiveConversationManyParticipantsPhone: Story = {
	name: 'Active conversation — six participants on the phone (1 + "+5")',
	globals: phone390Globals,
	render: () => renderSessionHeader(mockActiveConversationManyParticipants()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(1);
			expect(
				canvasElement.querySelector('[data-cy="participant-overflow"]')
					?.textContent
			).toBe('+5');
		});
		const { titleRect } = await expectTitleClearOfActions(canvasElement);
		const stack = canvasElement
			.querySelector('[data-cy="session-header-participants"]')!
			.getBoundingClientRect();
		await expect(
			titleRect.width / (titleRect.width + stack.width)
		).toBeGreaterThanOrEqual(0.4);
	}
};

/**
 * Waiting room (empty enquiry) with the add button.
 * Expected (Figma #430): add button on the LEFT + clock glyph on the RIGHT.
 * `showAddButton` opts this enquiry state into showing the "+".
 */
export const WaitingRoomWithAdd: Story = {
	render: () => renderSessionHeader(mockWaitingRoomWithAdd(), true),
	play: async ({ canvasElement }) => {
		await expectAddButtonLeftOfType(canvasElement);
		expect(
			canvasElement.querySelector('.chatroomMainInteractionIcon--waiting')
		).toBeTruthy();
	}
};

/**
 * Inquiry (non-empty enquiry) with the add button.
 * Expected (Figma #430): add button on the LEFT + red "C" glyph on the RIGHT.
 * `showAddButton` opts this enquiry state into showing the "+".
 */
export const InquiryWithAdd: Story = {
	render: () => renderSessionHeader(mockInquiryWithAdd(), true),
	play: async ({ canvasElement }) => {
		await expectAddButtonLeftOfType(canvasElement);
		expect(
			canvasElement.querySelector('.chatroomMainInteractionIcon--inquiry')
		).toBeTruthy();
	}
};

/**
 * Waiting room (empty enquiry), no add button.
 * Expected (Figma): clock glyph, no add button. Matches.
 */
export const WaitingRoom: Story = {
	render: () => renderSessionHeader(mockWaitingRoom())
};

/**
 * Inquiry (non-empty enquiry), no add button.
 * Expected (Figma): red "C" glyph, no add button. Matches.
 */
export const Inquiry: Story = {
	render: () => renderSessionHeader(mockInquiry())
};

/* ------------------------------------------------------------------ *
 * FE#1115 — request stage: "searching for a counsellor"
 * ------------------------------------------------------------------ */

/** FE#1115: exactly one magnet, inside the capsule, whose beam fades only outside it. */
const expectMagnetSearchesFromInsideTheCapsule = async (
	canvasElement: HTMLElement
) => {
	const magnet = await waitFor(() => {
		const element = canvasElement.querySelector<HTMLElement>(
			'.consultantSearchLoader'
		);
		expect(element).toBeTruthy();
		return element!;
	});
	const capsule = canvasElement.querySelector<HTMLElement>(
		'.chatroomMainInteractionIcon'
	)!;

	// 1. One magnet, and it is inside the capsule.
	await expect(
		canvasElement.querySelectorAll('.consultantSearchLoader')
	).toHaveLength(1);
	await expect(capsule.contains(magnet)).toBe(true);
	await expect(
		canvasElement.querySelector(
			'.chatroomMainInteractionIcon__typeGenerated'
		)
	).toBeNull();
	await expect(
		capsule.classList.contains('chatroomMainInteractionIcon--searching')
	).toBe(true);

	// 2. Nothing clips the beam, from the magnet up to the header itself.
	let ancestor: HTMLElement | null = magnet;
	while (ancestor && !ancestor.classList.contains('sessionInfo')) {
		await expect(getComputedStyle(ancestor).overflow).toBe('visible');
		ancestor = ancestor.parentElement;
	}

	// 3. Opaque when crossing the capsule's edge, spent well outside it. The pulse is
	//    one-shot, so start it here and step frozen animations through it.
	const sweep = magnet.querySelector<HTMLElement>(
		'.consultantSearchLoader__sweep'
	)!;
	const beam = magnet.querySelector<HTMLElement>(
		'.consultantSearchLoader__beam'
	)!;
	magnet.classList.add('consultantSearchLoader--pulsing');
	sweep.getAnimations().forEach((animation) => animation.pause());
	const capsuleBox = capsule.getBoundingClientRect();
	const flight = Number(
		beam.getAnimations()[0]!.effect!.getTiming().duration
	);
	const at = (fraction: number) => {
		beam.getAnimations().forEach((animation) => {
			animation.pause();
			animation.currentTime = flight * fraction;
		});
		return {
			box: beam.getBoundingClientRect(),
			opacity: Number.parseFloat(getComputedStyle(beam).opacity)
		};
	};
	const crossing = at(0.6);
	await expect(crossing.box.right).toBeGreaterThan(capsuleBox.right);
	await expect(crossing.opacity).toBeGreaterThan(0.8);
	const spent = at(1);
	await expect(spent.box.right).toBeGreaterThan(crossing.box.right);
	await expect(spent.opacity).toBeLessThan(0.1);

	// 4. Between pulses the magnet is still: no permanent spin in the header.
	magnet.classList.remove('consultantSearchLoader--pulsing');
	await expect(getComputedStyle(beam).animationName).toBe('none');
	await expect(getComputedStyle(sweep).animationName).toBe('none');

	return { magnet, capsule, capsuleBox };
};

/** The advice seeker's request stage at 1440 px: one magnet, beam fading outside the capsule. */
export const RequestStageSearching: Story = {
	name: 'Request stage — searching for a counsellor (FE#1115)',
	globals: desktop1440Globals,
	render: () => renderSessionHeader(mockRequestStageSearching()),
	play: async ({ canvasElement }) => {
		await expectMagnetSearchesFromInsideTheCapsule(canvasElement);
	}
};

/** The same stage on a tablet (834 px). */
export const RequestStageSearchingTablet: Story = {
	name: 'Request stage — searching, tablet 834 px (FE#1115)',
	globals: tablet834Globals,
	render: () => renderSessionHeader(mockRequestStageSearching()),
	play: async ({ canvasElement }) => {
		await expectMagnetSearchesFromInsideTheCapsule(canvasElement);
	}
};

/** The same stage on the phone (390 px), where no row clip may cut the beam. */
export const RequestStageSearchingPhone: Story = {
	name: 'Request stage — searching, phone 390 px (FE#1115)',
	globals: phone390Globals,
	render: () => renderSessionHeader(mockRequestStageSearching()),
	play: async ({ canvasElement }) => {
		await expectMagnetSearchesFromInsideTheCapsule(canvasElement);
	}
};

/** Only an enquiry is searched for (#1418): an empty one keeps its waiting clock and avatar stack. */
export const RequestStageEmptyEnquiry: Story = {
	name: 'Request stage — own empty enquiry: no magnet, stack stays (FE#1115)',
	globals: desktop1440Globals,
	render: () => renderSessionHeader(mockAskerEmptyEnquiry()),
	play: async ({ canvasElement }) => {
		const capsule = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.chatroomMainInteractionIcon'
			);
			expect(element).toBeTruthy();
			return element!;
		});
		await expect(
			capsule.classList.contains('chatroomMainInteractionIcon--waiting')
		).toBe(true);
		await expect(
			capsule.classList.contains('chatroomMainInteractionIcon--searching')
		).toBe(false);
		await expect(
			canvasElement.querySelector('.consultantSearchLoader')
		).toBeNull();
		await expect(
			canvasElement.querySelector(
				'[data-cy="session-header-participants"]'
			)
		).toBeTruthy();
	}
};

/** Once a counsellor accepts, the avatar takes the indicator's box, so the row does not jump. */
export const RequestStageAccepted: Story = {
	name: 'Request stage — counsellor accepted (FE#1115)',
	globals: desktop1440Globals,
	render: () => renderSessionHeader(mockRequestStageAccepted()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelector('[data-cy="participant-avatar"]')
			).toBeTruthy();
		});
	}
};
